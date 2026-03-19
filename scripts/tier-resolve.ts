#!/usr/bin/env bun

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
try {
  const envText = await Bun.file(envPath).text();
  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

export type ComplexityTier = "trivial" | "simple" | "moderate" | "complex";
export type TaskType = "coding" | "review" | "planning" | "analysis" | "debugging" | "documentation" | "general" | "data_science" | "devops" | "security" | "content";

export interface ComplexityEstimate {
  tier: ComplexityTier;
  score: number;
  signals: {
    wordCount: number;
    fileCount: number;
    hasMultiStep: boolean;
    hasTool: boolean;
    hasAnalysis: boolean;
    techStackCount: number;
    hasScopeModifier: boolean;
  };
  inferredTaskType: TaskType;
  detectedTechStack?: string[];
  scopeModifier?: "quick" | "thorough" | "experimental" | "production" | null;
}

interface ComboModel {
  provider: string;
  model: string;
  inputCostPer1M: number;
}

export interface OmniRouteRecommendation {
  recommendedCombo: { id: string; name: string; reason: string };
  alternatives: { id: string; name: string; tradeoff: string }[];
  freeAlternative: { id: string; name: string } | null;
}

export const TIER_TO_COMBO: Record<ComplexityTier, string> = {
  trivial: "light",
  simple: "light",
  moderate: "mid",
  complex: "heavy",
};

export const TIER_CANDIDATES: Record<ComplexityTier, string[]> = {
  trivial: ["light"],
  simple: ["light", "mid"],
  moderate: ["light", "mid", "heavy"],
  complex: ["light", "mid", "heavy", "failover"],
};

const TASK_FITNESS: Record<TaskType, { preferred: string[]; traits: string[] }> = {
  coding: { preferred: ["claude", "deepseek", "codex"], traits: ["fast", "code-optimized"] },
  review: { preferred: ["claude", "gemini", "openai"], traits: ["analytical", "thorough"] },
  planning: { preferred: ["gemini", "claude", "openai"], traits: ["reasoning", "structured"] },
  analysis: { preferred: ["gemini", "claude"], traits: ["deep-reasoning", "large-context"] },
  debugging: { preferred: ["claude", "deepseek", "codex"], traits: ["code-aware", "fast"] },
  documentation: { preferred: ["gemini", "claude", "openai"], traits: ["clear", "structured"] },
  general: { preferred: ["gemini", "openrouter"], traits: ["fast", "free", "light"] },
  data_science: { preferred: ["claude", "gemini"], traits: ["analytical", "code-aware"] },
  devops: { preferred: ["claude", "deepseek"], traits: ["infrastructure-aware", "fast"] },
  security: { preferred: ["claude", "gemini"], traits: ["thorough", "analytical"] },
  content: { preferred: ["gemini", "openai"], traits: ["creative", "structured"] },
};

const TECH_STACK_PATTERNS: Record<string, RegExp> = {
  react: /\b(react|jsx|tsx|next\.?js)\b/i,
  vue: /\b(vue|vuex|nuxt)\b/i,
  angular: /\b(angular|ng)\b/i,
  node: /\b(node\.?js|express|fastify|koa)\b/i,
  python: /\b(python|django|flask|fastapi)\b/i,
  docker: /\b(docker|container|dockerfile)\b/i,
  kubernetes: /\b(k8s|kubernetes|kubectl|helm)\b/i,
  terraform: /\b(terraform|tf|hcl)\b/i,
  aws: /\b(aws|ec2|s3|lambda|cloudfront)\b/i,
  gcp: /\b(gcp|google cloud|bigquery)\b/i,
  azure: /\b(azure|azuread)\b/i,
  postgres: /\b(postgres|postgresql|pg)\b/i,
  mongodb: /\b(mongo|mongodb)\b/i,
  redis: /\b(redis|cache)\b/i,
  graphql: /\b(graphql|gql)\b/i,
  grpc: /\b(grpc|protobuf)\b/i,
  oauth: /\b(oauth|oauth2|openid|oidc)\b/i,
  jwt: /\b(jwt|json web token)\b/i,
  auth: /\b(authentication|authorization|mfa|2fa|totp|saml|sso)\b/i,
  security: /\b(security|encrypt|decrypt|vulnerability|penetration|xss|csrf|injection)\b/i,
};

const SCOPE_MODIFIER_PATTERNS: Record<string, RegExp> = {
  quick: /\b(quick|fast|rapid|asap|urgent|immediate|briefly)\b/i,
  thorough: /\b(thorough|comprehensive|complete|detailed|exhaustive|in-depth|careful)\b/i,
  experimental: /\b(experimental|prototype|poc|proof.?of.?concept|exploratory|trial)\b/i,
  production: /\b(production|prod|live|deploy|release|ship|stable)\b/i,
};

const OMNIROUTE_BASE_URL = process.env.OMNIROUTE_BASE_URL || "http://localhost:20128";
const OMNIROUTE_API_KEY = process.env.OMNIROUTE_API_KEY || "";
const OMNIROUTE_COOKIE = process.env.OMNIROUTE_COOKIE || "";

function detectTechStack(text: string): string[] {
  const matches: string[] = [];
  for (const [tech, pattern] of Object.entries(TECH_STACK_PATTERNS)) {
    if (pattern.test(text)) matches.push(tech);
  }
  return matches;
}

function detectScopeModifier(text: string): "quick" | "thorough" | "experimental" | "production" | null {
  for (const [modifier, pattern] of Object.entries(SCOPE_MODIFIER_PATTERNS)) {
    if (pattern.test(text)) return modifier as any;
  }
  return null;
}

export function estimateComplexity(text: string): ComplexityEstimate {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean).length;
  const fileRefs = (lower.match(/\/[\w\-./]+\.\w+/g) || []).length;
  
  // Detect multi-step: explicit keywords OR multiple comma-separated requirements with "and"
  const hasExplicitMultiStep =
    /\b(then|after that|next|step \d|finally|first|second|third)\b/.test(lower) ||
    (lower.match(/\d+\.\s/g) || []).length >= 2;
  
  const commaCount = (lower.match(/,/g) || []).length;
  const hasAndAfterComma = /,.*\band\b/.test(lower);
  const hasImplicitMultiStep = commaCount >= 2 && hasAndAfterComma;
  
  const hasMultiStep = hasExplicitMultiStep || hasImplicitMultiStep;
  
  const hasTool = /\b(git|npm|bun|pip|curl|sed|grep|mkdir|chmod|docker)\b/.test(lower);
  const hasAnalysis = /\b(analy[zs]e|review|audit|compare|evaluate|assess|inspect)\b/.test(lower);
  
  const techStack = detectTechStack(text);
  const scopeModifier = detectScopeModifier(text);
  const techStackCount = techStack.length;
  const hasScopeModifier = scopeModifier !== null;

  const score =
    (words > 50 ? 1 : 0) +
    (fileRefs > 0 ? 1 : 0) +
    (hasMultiStep ? 2 : 0) +
    (hasTool ? 1 : 0) +
    (hasAnalysis ? 1 : 0) +
    (techStackCount >= 2 ? 2 : 0) +
    (scopeModifier === "thorough" || scopeModifier === "production" ? 2 : 0);

  let tier: ComplexityTier;
  if (score <= 1) tier = "trivial";
  else if (score <= 3) tier = "simple";
  else if (score <= 5) tier = "moderate";
  else tier = "complex";

  const inferredTaskType = inferTaskType(lower);

  return { 
    tier, 
    score, 
    signals: { 
      wordCount: words, 
      fileCount: fileRefs, 
      hasMultiStep, 
      hasTool, 
      hasAnalysis,
      techStackCount,
      hasScopeModifier,
    }, 
    inferredTaskType,
    detectedTechStack: techStack.length > 0 ? techStack : undefined,
    scopeModifier,
  };
}

export function inferTaskType(text: string): TaskType {
  const patterns: [TaskType, RegExp][] = [
    ["debugging", /\b(debug|fix|bug|error|crash|broken|stack.?trace|exception|fail(ure)?|issue|problem|troubleshoot|diagnose)\b/],
    ["analysis", /\b(analy[zs]e|assess|evaluate|audit|investigate|research|compare|examine|inspect|study|explore)\b/],
    ["review", /\b(review|pr|pull.?request|code.?review|diff|feedback|critique|assess.?code|examine.?code)\b/],
    ["planning", /\b(plan|design|architect|roadmap|strategy|outline|proposal|rfc|spec|blueprint|scheme)\b/],
    ["documentation", /\b(document|readme|docs|write.?up|explain|tutorial|guide|manual|howto|walkthrough)\b/],
    ["data_science", /\b(model|train|dataset|ml|machine.?learning|ai|neural|pandas|numpy|scikit|tensorflow|pytorch|data.?analysis|predict|classification|regression)\b/],
    ["devops", /\b(deploy|ci|cd|pipeline|docker|kubernetes|k8s|terraform|ansible|jenkins|github.?actions|infrastructure|provision|orchestrate)\b/],
    ["security", /\b(security|vulnerability|cve|exploit|penetration|compliance|encryption|auth(entication)?|authorization|owasp|xss|sql.?injection)\b/],
    ["content", /\b(write|blog|article|post|copy|content|marketing|seo|draft|compose)\b/],
    ["coding", /\b(implement|build|create|write|code|develop|add|refactor|migrate|deploy|construct|program)\b/],
  ];

  for (const [taskType, pattern] of patterns) {
    if (pattern.test(text)) return taskType;
  }
  return "general";
}

export async function fetchCombos(): Promise<any[]> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (OMNIROUTE_API_KEY) headers["Authorization"] = `Bearer ${OMNIROUTE_API_KEY}`;
  if (OMNIROUTE_COOKIE) headers["Cookie"] = OMNIROUTE_COOKIE;

  const resp = await fetch(`${OMNIROUTE_BASE_URL}/api/combos`, {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  if (!resp.ok) throw new Error(`OmniRoute /api/combos returned ${resp.status}`);
  const data: any = await resp.json();
  return Array.isArray(data) ? data : (data.combos ?? []);
}

function getComboModels(combo: any): ComboModel[] {
  const models = combo.models ?? combo.data?.models ?? [];
  return models.map((m: any) => ({
    provider: m.provider ?? "unknown",
    model: m.model ?? "",
    inputCostPer1M: m.inputCostPer1M ?? 3.0,
  }));
}

export function bestComboForTask(
  combos: any[],
  taskType: TaskType,
  complexityTier: ComplexityTier,
  budgetConstraint?: number,
  latencyConstraint?: number,
): OmniRouteRecommendation {
  const fitness = TASK_FITNESS[taskType] || TASK_FITNESS.general;
  const enabled = combos.filter((c) => c.enabled !== false);
  const allowedNames = TIER_CANDIDATES[complexityTier];

  const tierFiltered = enabled.filter((c) => {
    const name = (c.name ?? "").toLowerCase();
    if (allowedNames.some((allowed) => name === allowed)) return true;
    return complexityTier === "complex";
  });

  const pool = tierFiltered.length > 0 ? tierFiltered : enabled;

  if (pool.length === 0) {
    return {
      recommendedCombo: { id: "none", name: "none", reason: "No enabled combos available" },
      alternatives: [],
      freeAlternative: null,
    };
  }

  const scored = pool.map((combo) => {
    const models = getComboModels(combo);
    let score = 0;

    for (const model of models) {
      const prefIdx = fitness.preferred.indexOf(model.provider);
      if (prefIdx >= 0) score += (fitness.preferred.length - prefIdx) * 10;
    }

    const name = (combo.name ?? "").toLowerCase();
    for (const trait of fitness.traits) {
      if (name.includes(trait)) score += 5;
    }

    if (complexityTier === "trivial" || complexityTier === "simple") {
      if (name.includes("heavy") || name.includes("failover")) score -= 15;
      if (name.includes("light")) score += 10;
    }
    if (complexityTier === "trivial" && name.includes("light")) score += 5;

    const isFree =
      name.includes("free") ||
      models.every((m: ComboModel) => m.provider.toLowerCase().includes("free"));

    return { combo, score, isFree };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const alternatives = scored.slice(1, 4).map((s) => ({
    id: s.combo.id ?? "",
    name: s.combo.name ?? "",
    tradeoff: s.isFree
      ? "free but may have limits"
      : s.score < best.score * 0.5
        ? "cheaper but slower"
        : "similar quality, different providers",
  }));
  const freeAlt = scored.find((s) => s.isFree && s !== best);

  return {
    recommendedCombo: {
      id: best.combo.id ?? "",
      name: best.combo.name ?? "",
      reason: `Best match for "${taskType}" at ${complexityTier} complexity: preferred providers (${fitness.preferred.slice(0, 3).join(", ")})`,
    },
    alternatives,
    freeAlternative: freeAlt ? { id: freeAlt.combo.id ?? "", name: freeAlt.combo.name ?? "" } : null,
  };
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`tier-resolve — Classify prompt complexity, infer task type, and recommend OmniRoute combo

Usage:
  bun tier-resolve.ts "your prompt text here"
  bun tier-resolve.ts --json "prompt text"
  bun tier-resolve.ts --omniroute "prompt text"
  bun tier-resolve.ts --task-type coding --budget 0.05
  echo "prompt text" | bun tier-resolve.ts
  bun tier-resolve.ts --file /path/to/prompt.txt

Modes:
  (default)     Output the static tier-to-combo mapping (light/mid/heavy)
  --json        Output full JSON: tier, combo, score, signals, inferredTaskType
  --omniroute   Query OmniRoute's best_combo_for_task (live combo recommendation)
                Falls back to static mapping if OmniRoute is unreachable

Options:
  --task-type TYPE   Override inferred task type (coding|review|planning|analysis|debugging|documentation)
  --budget USD       Max cost constraint (passed to OmniRoute recommendation)
  --latency MS       Max latency constraint (passed to OmniRoute recommendation)
  --file PATH        Read prompt from a file
  -h, --help         Show this help

Static tier → combo mapping:
  trivial  → light
  simple   → light
  moderate → mid
  complex  → heavy

Task type inference:
  The prompt text is scanned for keywords to infer taskType:
    debugging      → fix, bug, error, crash, debug
    review         → review, pr, diff, feedback
    analysis       → analyse, evaluate, audit, investigate
    planning       → plan, design, architect, roadmap
    documentation  → document, readme, docs, tutorial
    coding         → implement, build, create, write (default)

OmniRoute integration (--omniroute):
  Calls OmniRoute's /api/combos endpoint and scores enabled combos by:
    • Provider preference (per task type)
    • Combo name trait matching
    • Budget/latency constraints
  Returns recommended combo, alternatives, and free fallback.

Environment:
  OMNIROUTE_BASE_URL   OmniRoute base URL (default: http://localhost:20128)
  OMNIROUTE_API_KEY    Bearer token for OmniRoute API auth
  OMNIROUTE_COOKIE     Cookie header for OmniRoute session auth

Examples:
  bun tier-resolve.ts "fix the typo in README.md"
  # → light

  bun tier-resolve.ts --json "analyse the codebase and run git diff"
  # → {"tier":"moderate","combo":"mid","score":3,...,"inferredTaskType":"analysis"}

  bun tier-resolve.ts --omniroute "review the PR and check for security issues"
  # → {"complexity":{"tier":"simple",...},"omniroute":{"recommendedCombo":{...},...}}

  bun tier-resolve.ts --omniroute --task-type planning --budget 0.10 "design a new auth system"
`);
    process.exit(0);
  }

  const omniRouteMode = args.includes("--omniroute");
  const jsonMode = args.includes("--json");
  const comboOnly = !jsonMode && !omniRouteMode;

  const taskTypeIdx = args.indexOf("--task-type");
  const taskTypeOverride = taskTypeIdx !== -1 ? (args[taskTypeIdx + 1] as TaskType | undefined) : undefined;

  const budgetIdx = args.indexOf("--budget");
  const budgetConstraint = budgetIdx !== -1 ? parseFloat(args[budgetIdx + 1]) : undefined;

  const latencyIdx = args.indexOf("--latency");
  const latencyConstraint = latencyIdx !== -1 ? parseFloat(args[latencyIdx + 1]) : undefined;

  const flagArgs = new Set(["--json", "--omniroute", "--combo-only"]);
  const paramFlags = new Set(["--task-type", "--budget", "--latency", "--file"]);
  const filteredArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (flagArgs.has(args[i])) continue;
    if (paramFlags.has(args[i])) { i++; continue; }
    if (!args[i].startsWith("--")) filteredArgs.push(args[i]);
  }

  let text = "";

  const fileIdx = args.indexOf("--file");
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    const filePath = args[fileIdx + 1];
    try {
      text = await Bun.file(filePath).text();
    } catch (e: any) {
      console.error(`Error reading file: ${e.message}`);
      process.exit(1);
    }
  } else if (filteredArgs.length > 0) {
    text = filteredArgs.join(" ");
  } else {
    const isTTY = process.stdin.isTTY;
    if (isTTY) {
      console.error("Error: No prompt text provided. Use --help for usage.");
      process.exit(1);
    }
    text = await readStdin();
  }

  if (!text.trim()) {
    console.error("Error: Empty prompt text.");
    process.exit(1);
  }

  const complexity = estimateComplexity(text);
  const staticCombo = TIER_TO_COMBO[complexity.tier];
  const taskType = taskTypeOverride ?? complexity.inferredTaskType;

  if (omniRouteMode) {
    let omniResult: OmniRouteRecommendation | null = null;
    let omniError: string | null = null;

    try {
      const combos = await fetchCombos();
      omniResult = bestComboForTask(combos, taskType, complexity.tier, budgetConstraint, latencyConstraint);
    } catch (e: any) {
      omniError = e.message;
    }

    const output: any = {
      complexity: {
        tier: complexity.tier,
        score: complexity.score,
        signals: complexity.signals,
        inferredTaskType: taskType,
        staticCombo,
      },
    };

    if (omniResult) {
      output.omniroute = omniResult;
      output.resolvedCombo = omniResult.recommendedCombo.name;
    } else {
      output.omniroute = null;
      output.omnirouteError = omniError;
      output.resolvedCombo = staticCombo;
    }

    console.log(JSON.stringify(output, null, 2));
  } else if (jsonMode) {
    console.log(JSON.stringify({
      tier: complexity.tier,
      combo: staticCombo,
      score: complexity.score,
      signals: complexity.signals,
      inferredTaskType: taskType,
    }));
  } else {
    console.log(staticCombo);
  }
}

if (import.meta.main) {
  main();
}
