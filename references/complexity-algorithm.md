# Complexity Estimation Algorithm

## Overview

The tier resolver uses a multi-signal heuristic to estimate task complexity and infer task type. This determines which model combo tier (light/mid/heavy) is most appropriate.

## Complexity Scoring

Complexity score ranges from 0.0 (trivial) to 1.0 (complex).

### Signals

| Signal | Weight | Description |
|--------|--------|-------------|
| Word Count | Variable | 0-20 words = 0.1, 20-50 = 0.3, 50-100 = 0.5, 100+ = 0.7 |
| File References | 0.1 per file | Each `/path/to/file` pattern adds 0.1 (max 0.5) |
| Multi-Step | 0.2 | Presence of: "first", "then", "after", "finally", "step 1", etc. |
| Tool Usage | 0.15 | Keywords: "search", "run", "execute", "query", "fetch", "install" |
| Analysis Required | 0.15 | Keywords: "analyze", "investigate", "review", "evaluate", "assess" |

### Formula

```
score = min(1.0, wordScore + fileScore + multiStepScore + toolScore + analysisScore)
```

### Tier Mapping

| Score Range | Tier | Static Combo |
|-------------|------|--------------|
| 0.0 - 0.3 | trivial | swarm-light |
| 0.3 - 0.5 | simple | swarm-light |
| 0.5 - 0.7 | moderate | swarm-mid |
| 0.7 - 1.0 | complex | swarm-heavy |

## Task Type Inference

The script infers task type based on keyword matching:

| Type | Keywords |
|------|----------|
| coding | "implement", "add", "create", "build", "write code", "function", "class", "method" |
| review | "review", "analyze code", "audit", "inspect", "check", "critique" |
| planning | "plan", "design", "architecture", "roadmap", "strategy", "organize" |
| analysis | "analyze", "investigate", "research", "study", "explore", "examine" |
| debugging | "fix", "debug", "solve", "troubleshoot", "resolve", "error", "bug" |
| documentation | "document", "write docs", "README", "explain", "describe", "guide" |
| general | (default if no match) |

## OmniRoute Combo Scoring

Once complexity tier and task type are determined, the script scores all available combos:

### Base Score

- **Capability match**: +20 if combo's `defaultCapabilities` includes the task type
- **Trait match**: +5 per matching trait (e.g., "coding", "analysis", "planning")

### Tier Penalties/Bonuses

- **Trivial/Simple tasks**:
  - Heavy/failover combos: -15 (avoid overkill)
  - Light combos: +10 (prefer efficiency)
  - If trivial tier: additional +5 for light

- **Complex tasks**:
  - Heavy combos: +15 (prefer power)
  - Light combos: -10 (avoid underpowering)

### Free Model Bonus

- If combo uses only free models and user set `--budget 0`: +30

### Budget Filtering

- Combos exceeding `--budget` threshold are excluded before scoring

### Latency Preference

- `--latency fast`: boost combos with "fast" trait
- `--latency quality`: boost combos with "quality" or "heavy" trait

## Examples

### Example 1: Simple Task

```
Prompt: "Summarize this article"
```

- Word count: 3 → 0.1
- File count: 0 → 0.0
- Multi-step: false → 0.0
- Tool usage: false → 0.0
- Analysis: false → 0.0
- **Total: 0.1 (trivial)**
- **Inferred type: general**
- **Static combo: swarm-light**

### Example 2: Moderate Task

```
Prompt: "Review the authentication logic in /home/workspace/app/auth.ts and suggest improvements"
```

- Word count: 11 → 0.3
- File count: 1 → 0.1
- Multi-step: false → 0.0
- Tool usage: false → 0.0
- Analysis: true (review, suggest) → 0.15
- **Total: 0.55 (moderate)**
- **Inferred type: review**
- **Static combo: swarm-mid**

### Example 3: Complex Task

```
Prompt: "Implement a new user registration flow. First, add the schema migration in /db/migrations/. Then create the API endpoint in /api/users.ts. Finally, add form validation and error handling. Run tests after each step."
```

- Word count: 32 → 0.5
- File count: 2 → 0.2
- Multi-step: true (First, Then, Finally) → 0.2
- Tool usage: true (Run tests) → 0.15
- Analysis: false → 0.0
- **Total: 1.0 (complex)**
- **Inferred type: coding**
- **Static combo: swarm-heavy**

## Tuning

To adjust complexity estimation for your use case, edit the thresholds in `tier-resolve.ts`:

```typescript
// Word count thresholds
if (wordCount < 20) score = 0.1;
else if (wordCount < 50) score = 0.3;
else if (wordCount < 100) score = 0.5;
else score = 0.7;

// File count weight
const fileScore = Math.min(0.5, fileCount * 0.1);

// Boolean signal weights
const multiStepScore = hasMultiStep ? 0.2 : 0;
const toolScore = hasTool ? 0.15 : 0;
const analysisScore = hasAnalysis ? 0.15 : 0;
```

## Fallback Behavior

If OmniRoute is unreachable or returns no combos, the script falls back to static tier mapping:

- `trivial` → `swarm-light`
- `simple` → `swarm-light`
- `moderate` → `swarm-mid`
- `complex` → `swarm-heavy`

This ensures the script always returns a usable combo name, even if OmniRoute is offline.
