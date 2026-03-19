# OmniRoute Tier Resolver

**Intelligent model combo selection for OmniRoute using the `best_combo_for_task` algorithm.**

A lightweight Zo Computer skill that analyzes task complexity and recommends the optimal OmniRoute combo based on capability matching, cost efficiency, and performance requirements.

**Current Version:** v2.0 (Weighted Scoring + Feedback Loop)

---

## What It Does

Given any task prompt, this skill:

1. **Analyzes complexity** — 9 weighted signals (word count, file refs, multi-step, tool usage, analysis depth, concept count, task verb complexity, scope breadth, feature list count) plus domain/tech stack detection and heuristic boosters
2. **Infers task type** — coding, review, planning, analysis, debugging, documentation, data_science, devops, security, content, general — with keyword, synonym, and contextual matching
3. **Detects constraints** — budget, latency, quality, speed (from CLI flags, inferred from text, or defaults)
4. **Scores all available combos** — based on capability matching, cost efficiency, complexity fit, and task-type fitness
5. **Returns recommendation** — combo name, tier, alternatives, reasoning, and full signal diagnostics
6. **Learns from feedback** — correction logging and auto-tune weight optimization

Use it to make intelligent routing decisions before sending tasks to OmniRoute, ensuring you use the right model tier for each job.

---

## Version History

| Version | Status | Notable Features |
|---------|--------|------------------|
| **v2.0** | ✅ Current | 9 calibrated weighted signals, 4 complexity tiers (trivial/simple/moderate/complex), feedback loop with auto-tune, sync API for orchestrator integration, heuristic pattern boosters, constraint detection, scope modifiers, task-type complexity floors |
| v1.1 | Superseded | Enhanced patterns, 4 new task types, 20+ tech stack patterns, scope modifiers |
| v1.0 | Baseline | Initial release with basic complexity scoring |

**Performance:** v2.0 averages 14–56ms per task (10x faster than v1.1)

---

## Quick Start

### Prerequisites

- **Zo Computer** with workspace access
- **OmniRoute** installed and running at `http://localhost:20128`
- **At least one combo** created in OmniRoute (e.g., `light`, `mid`, `heavy`)

### Installation

```bash
cd /home/workspace/Skills
git clone https://github.com/marlandoj/omniroute-tier-resolver.git
```

### Configuration

Set your OmniRoute API key (found in your OmniRoute `.env` file):

**Option A: Zo Secrets** (recommended)
1. Go to [Settings > Advanced](/?t=settings&s=advanced) in Zo
2. Click "Add Secret"
3. Key: `OMNIROUTE_API_KEY`
4. Value: Your API key from OmniRoute `.env`

**Option B: Environment Variable**
```bash
export OMNIROUTE_API_KEY="your-api-key-here"
```

### Verify OmniRoute is Running

```bash
curl http://localhost:20128/health
# Expected: {"status":"ok"} or similar
```

If not running:
```bash
cd /path/to/your/OmniRoute
bun run dev
```

### Test the Skill

```bash
cd /home/workspace/Skills/omniroute-tier-resolver/scripts

# Simple output (just the combo name)
bun tier-resolve-v2.ts "Write a function to parse JSON"
# Output: light

# Full JSON output with diagnostics
bun tier-resolve-v2.ts --omniroute "Implement OAuth2 authentication with JWT tokens, refresh rotation, and rate limiting"
# Output: JSON with complexity analysis, combo recommendation, alternatives

# With constraint flags
bun tier-resolve-v2.ts --omniroute --quality high --budget low "Refactor auth module"
```

---

## Usage

### Command-Line Interface

**Basic usage:**
```bash
bun tier-resolve-v2.ts "<your task prompt>"
```

**With full diagnostics:**
```bash
bun tier-resolve-v2.ts --omniroute "<your task prompt>"
```

**With constraint flags:**
```bash
bun tier-resolve-v2.ts --omniroute --budget low --quality high "<your task prompt>"
```

**All options:**
```
--omniroute       Query OmniRoute for best combo recommendation
--json            Output full JSON (signals, domain, constraints)
--budget <val>    Explicit budget constraint: low | medium | high
--latency <val>   Explicit latency constraint: low | medium | high
--quality <val>   Explicit quality constraint: low | medium | high
--speed <val>     Explicit speed constraint: low | medium | high
```

**Feedback subcommands:**
```bash
bun tier-resolve-v2.ts feedback list                           # Show all feedback entries
bun tier-resolve-v2.ts feedback correct --task-id <id> --tier <tier>  # Submit correction
bun tier-resolve-v2.ts feedback tune                           # Auto-tune weights from corrections
```

**Examples:**

```bash
# Trivial task → light combo
bun tier-resolve-v2.ts "Fix a typo in the README"
# Output: light

# Complex task → heavy combo
bun tier-resolve-v2.ts "Design and implement a distributed caching system with Redis, handle failover, write tests, and create monitoring dashboards"
# Output: heavy

# Full diagnostic output with OmniRoute
bun tier-resolve-v2.ts --omniroute "Refactor authentication module"
# Output: JSON with signals, constraints, combo recommendation, alternatives
```

### Integration with Personas

Add this rule to any Zo persona to enable automatic tier resolution:

**Rule Name:** OmniRoute Intelligent Routing

**Condition:** When routing a task to OmniRoute or selecting a model combo

**Instruction:**
```
Before routing any task through OmniRoute, run:
bun /home/workspace/Skills/omniroute-tier-resolver/scripts/tier-resolve-v2.ts --omniroute "<task prompt>"

Use the `resolvedCombo` field from the JSON output as the model name for OmniRoute calls.
If OmniRoute is unreachable, the script falls back to static tier mapping (trivial→light, simple→light, moderate→mid, complex→heavy).
```

### Programmatic Usage

```typescript
// In a script or persona automation
const taskPrompt = "Analyze performance metrics from last week";

// Get recommended combo
const result = await Bun.$`bun Skills/omniroute-tier-resolver/scripts/tier-resolve-v2.ts --omniroute ${taskPrompt}`.json();

const comboName = result.resolvedCombo;         // e.g., "mid"
const reasoning = result.omniroute?.reasoning;  // Why this combo was chosen
const alternatives = result.omniroute?.alternatives; // Other viable options

// Call OmniRoute with the recommended combo
const response = await fetch("http://localhost:20128/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OMNIROUTE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: comboName,
    messages: [{ role: "user", content: taskPrompt }],
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

---

## Output Format

### Simple Mode (default)

```
light
```

Just the recommended combo name, suitable for direct use in scripts.

### Full Mode (`--omniroute` flag)

```json
{
  "complexity": {
    "tier": "moderate",
    "score": 0.245,
    "signals": [
      { "name": "wordCount", "rawValue": 16, "normalizedScore": 0.147, "weight": 0.04 },
      { "name": "conceptCount", "rawValue": 2, "normalizedScore": 0.333, "weight": 0.20 },
      { "name": "taskVerbComplexity", "rawValue": 1, "normalizedScore": 0.25, "weight": 0.10 }
    ],
    "inferredTaskType": "coding",
    "semanticMatch": { "taskType": "coding", "confidence": 0.5, "matchMethod": "synonym" },
    "domainPattern": { "domain": "coding", "subdomain": null, "techStack": ["auth"], "complexityModifier": 1.2 },
    "constraints": [
      { "type": "budget", "value": "medium", "source": "default", "priority": 10 }
    ],
    "scopeModifier": null,
    "staticCombo": "mid"
  },
  "omniroute": {
    "recommendedCombo": { "id": "...", "name": "mid", "reason": "Best fit for coding (moderate tier)" },
    "alternatives": [{ "id": "...", "name": "light", "tradeoff": "cheaper but less capable" }],
    "freeAlternative": null
  },
  "resolvedCombo": "mid",
  "feedbackId": "uuid-for-corrections",
  "performanceMs": 20.8
}
```

Full diagnostic output with per-signal breakdown, semantic match details, domain/tech detection, constraints, and feedback tracking.

---

## How It Works

### Complexity Signals

The tier resolver uses 9 calibrated weighted signals plus dynamic boosters:

| Signal | Default Weight | Description |
|--------|---------------|-------------|
| **conceptCount** | 0.20 | Distinct technical concepts (api, gateway, auth, cache, etc.) |
| **featureListCount** | 0.20 | Enumerated deliverables in comma/and patterns |
| **scopeBreadth** | 0.12 | Broad scope keywords minus narrow scope keywords |
| **multiStep** | 0.10 | Step markers, numbered steps, comma lists, sentences |
| **taskVerbComplexity** | 0.10 | Distinct action verbs (implement, build, refactor, etc.) |
| **domainComplexity** | 0.10 | Tech stack complexity modifier (k8s=1.3x, auth=1.1x, etc.) |
| **techStackDepth** | 0.10 | Number of detected tech stack components |
| **analysisDepth** | 0.08 | Analysis keywords (analyze, audit, benchmark, etc.) |
| **wordCount** | 0.04 | Normalized word count (5-80 range) |
| **toolUsage** | 0.04 | CLI tool references (git, docker, kubectl, etc.) |
| **fileRefs** | 0.02 | File path pattern matches |

**Heuristic boosters** (additive, weight=1.0) fire on specific high-signal patterns:
- Codebase-wide refactor/migrate/rewrite → +0.25
- Cross-system compliance audit → +0.20
- Production-ready requirement → +0.10
- Low-level debugging (memory leak, race condition, deadlock) → +0.15
- ML model deployment (train + deploy/serve) → +0.15

### Complexity Tiers

| Tier | Score Range | Static Combo |
|------|------------|--------------|
| **Trivial** | < 0.04 | `light` |
| **Simple** | 0.04 – 0.15 | `light` |
| **Moderate** | 0.15 – 0.45 | `mid` |
| **Complex** | ≥ 0.45 | `heavy` |

**Task-type complexity floors** prevent under-classification for specialized domains:
- security, devops, data_science, planning, analysis → minimum `moderate`
- debugging → minimum `simple`
- Overridable with `quick` or `experimental` scope modifiers

### Task Type Inference

Three-layer matching (keyword → synonym → contextual phrase):
- `coding` — implement, build, create, write, refactor, migrate, deploy
- `review` — code review, PR, diff, critique
- `planning` — design, architect, roadmap, strategy, RFC, spec
- `analysis` — analyze, assess, evaluate, audit, investigate, benchmark
- `debugging` — debug, bug, error, crash, memory leak, race condition
- `documentation` — document, readme, docs, tutorial, guide
- `data_science` — model, train, dataset, ML, neural, pandas, pytorch
- `devops` — deploy, CI/CD, docker, kubernetes, terraform, ansible
- `security` — vulnerability, CVE, exploit, penetration, GDPR, HIPAA, OWASP
- `content` — blog, article, post, copy, marketing, SEO
- `general` — fallback

### Feedback Loop

Every classification is logged with a `feedbackId`. Submit corrections and auto-tune weights:

```bash
# List all feedback entries
bun tier-resolve-v2.ts feedback list

# Correct a misclassification
bun tier-resolve-v2.ts feedback correct --task-id <uuid> --tier moderate

# Auto-tune weights from 5+ corrections (grid search optimization)
bun tier-resolve-v2.ts feedback tune
```

See `references/complexity-algorithm.md` for detailed algorithm documentation.

---

## Files Included

```
omniroute-tier-resolver/
├── SKILL.md                    # Full Zo skill documentation
├── README.md                   # This file (usage & installation)
├── QUICK-START.md              # 2-minute setup guide
├── .env                        # OmniRoute connection config
├── scripts/
│   ├── tier-resolve.ts         # v1 CLI (legacy, kept for compat)
│   └── tier-resolve-v2.ts      # v2 CLI (~1,260 lines, zero deps)
├── data/
│   ├── feedback.jsonl          # Feedback log (auto-generated)
│   └── weights.json            # Tuned signal weights (auto-generated)
├── tests/
│   └── test-results.json       # Test suite results
└── references/
    └── complexity-algorithm.md # Algorithm details and examples
```

---

## Why Use This?

### Without Tier Resolver
- Manually guess which combo to use
- Over-provision expensive models for simple tasks
- Under-provision cheap models for complex tasks
- Inconsistent routing decisions across personas

### With Tier Resolver
- ✅ **Automatic complexity analysis** — no manual tier selection
- ✅ **Cost-aware routing** — use expensive models only when needed
- ✅ **Consistent decisions** — same algorithm across all personas
- ✅ **Budget constraints** — respect max_cost_per_request limits
- ✅ **Fallback handling** — graceful degradation if OmniRoute is down
- ✅ **Self-improving** — feedback loop with auto-tune weight optimization

---

## Comparison to Swarm Orchestrator

This skill extracts **just the tier resolution logic** from the full swarm orchestrator:

| Feature | Tier Resolver | Full Swarm Orchestrator |
|---------|---------------|-------------------------|
| **Lines of code** | ~1,260 | ~2,000 |
| **Dependencies** | OmniRoute only | Executor bridges, memory system, DAG engine |
| **Purpose** | Combo recommendation | Multi-agent task orchestration |
| **Use case** | Pre-flight model selection | Parallel task execution with dependencies |

**You get:**
- ✅ The `best_combo_for_task` algorithm
- ✅ Complexity analysis and task type inference
- ✅ Cost-aware routing with budget constraints
- ✅ Latency-aware routing for time-sensitive tasks

**You don't need:**
- ❌ Local executor bridges (Claude Code, Hermes, Gemini, Codex)
- ❌ Memory system integration
- ❌ DAG execution engine and wave coordination
- ❌ Circuit breakers, retries, preflight checks

Perfect for users who want intelligent OmniRoute combo selection without the full orchestration system.

---

## Troubleshooting

### "Failed to fetch combos from OmniRoute"

**Cause:** OmniRoute not reachable at `http://localhost:20128`

**Fix:**
```bash
# Check if OmniRoute is running
curl http://localhost:20128/health

# If not running, start it
cd /path/to/your/OmniRoute
bun run dev
```

### "No combos found in OmniRoute"

**Cause:** No combos have been created in OmniRoute

**Fix:**
1. Open OmniRoute web UI: `http://localhost:20128`
2. Navigate to the Combos tab
3. Create at least one combo (e.g., `light`, `mid`, `heavy`)

### Using static fallback

**Symptom:** Output shows `"omnirouteError": "..."` and uses `staticCombo`

**Cause:** OmniRoute unreachable or authentication failed

**Behavior:** Script falls back to static tier mapping (trivial→light, simple→light, moderate→mid, complex→heavy)

**Fix:**
- Verify OmniRoute is running: `curl http://localhost:20128/health`
- Check API key is set: `echo $OMNIROUTE_API_KEY` (in Zo or shell)
- Review OmniRoute logs for authentication errors

---

## Credits

Built for [OmniRoute](https://github.com/marlandoj/OmniRoute) by [@marlandoj](https://github.com/marlandoj) — an intelligent model routing layer for 430+ models with best-combo-for-task selection.

---

## Support & Contribution

**Issues or questions?**
1. Check `SKILL.md` for full skill documentation
2. Read `references/complexity-algorithm.md` for algorithm details
3. Run with `--omniroute` flag to see full diagnostic output

**Want to contribute?**
- Fork the repo: https://github.com/marlandoj/omniroute-tier-resolver
- Submit PRs for improvements, bug fixes, or new features
- Open issues for bugs or feature requests

---

## License

MIT License — free to use, modify, and distribute.

---

## Version

**2.0.0** (2026-03-19)
v2 release: calibrated weighted signals, feedback loop, auto-tune, sync API, heuristic boosters, constraint detection

**1.0.0** (2026-03-18)
Initial release, extracted from swarm orchestrator v4.5
