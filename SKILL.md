---
name: omniroute-tier-resolver
description: Standalone skill for intelligent OmniRoute combo selection. Analyzes task complexity and recommends the best model combo using best_combo_for_task algorithm. Works independently without swarm orchestrator.
compatibility: Created for Zo Computer with OmniRoute installed
metadata:
  author: marlandoj.zo.computer
  created: 2026-03-18
  version: 1.0.0
---

# OmniRoute Tier Resolver

Standalone skill that provides intelligent model combo selection for OmniRoute using the `best_combo_for_task` algorithm.

## What It Does

Given a task prompt, this skill:
1. **Analyzes complexity** — word count, file references, multi-step indicators, tool usage
2. **Infers task type** — coding, review, planning, analysis, debugging, documentation, general
3. **Scores all available combos** — based on capability matching, cost efficiency, and complexity fit
4. **Returns recommendation** — combo name, tier, model lineup, cost estimate, and alternatives

## Use Cases

- **Persona routing** — Let any persona query optimal model before delegating work
- **Cost optimization** — Avoid using heavyweight combos for simple tasks
- **Budget-aware selection** — Filter by cost constraints (e.g., free-only, max $0.05 per 1M tokens)
- **Latency-sensitive tasks** — Prefer fast-tier combos for real-time needs

## Prerequisites

- **OmniRoute installed** at `http://localhost:20128`
- **API key configured** in OmniRoute `.env` file
- **Combos created** (e.g., `swarm-light`, `swarm-mid`, `swarm-heavy`, or custom combos)

## Quick Start

### Basic Usage

```bash
cd Skills/omniroute-tier-resolver/scripts

# Get recommended combo for a task
bun tier-resolve.ts --omniroute "Fix the authentication bug in login.ts"

# Get just the combo name (for scripting)
bun tier-resolve.ts "Analyze the performance metrics"
```

### Output Format

**Default mode** (combo name only):
```
swarm-mid
```

**OmniRoute mode** (`--omniroute` flag) returns full JSON:
```json
{
  "complexity": {
    "tier": "moderate",
    "score": 0.64,
    "signals": {
      "wordCount": 12,
      "fileCount": 2,
      "hasMultiStep": true,
      "hasTool": false,
      "hasAnalysis": true
    },
    "inferredTaskType": "debugging",
    "staticCombo": "swarm-mid"
  },
  "omniroute": {
    "recommendedCombo": {
      "id": "combo-abc123",
      "name": "swarm-mid",
      "description": "Balanced combo for moderate tasks",
      "models": [
        {
          "provider": "anthropic",
          "model": "claude-sonnet-4-20250514",
          "inputCostPer1M": 3.0
        }
      ],
      "estimatedCostPer1M": 3.0,
      "traits": ["balanced", "coding", "analysis"]
    },
    "alternatives": [
      {
        "name": "swarm-light",
        "score": 62,
        "isFree": false
      },
      {
        "name": "swarm-heavy",
        "score": 58,
        "isFree": false
      }
    ]
  },
  "resolvedCombo": "swarm-mid"
}
```

### Integration Example

Use in a persona prompt or rule:

```typescript
// Get recommended combo
const { stdout } = await Bun.$`bun Skills/omniroute-tier-resolver/scripts/tier-resolve.ts --omniroute "${taskPrompt}"`;
const result = JSON.parse(stdout);
const comboName = result.resolvedCombo;

// Use combo for OmniRoute call
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
```

## CLI Reference

```bash
bun tier-resolve.ts [flags] "<task prompt>"
```

### Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--omniroute` | Full JSON output with combo details | `--omniroute "task"` |
| `--json` | JSON output (complexity only, no OmniRoute) | `--json "task"` |
| `--task-type <type>` | Override inferred task type | `--task-type coding` |
| `--budget <n>` | Max cost per 1M input tokens (USD) | `--budget 2.0` |
| `--latency <tier>` | Prefer fast/balanced/quality tiers | `--latency fast` |

### Task Types

- `coding` — Writing or modifying code
- `review` — Code review, analysis, critique
- `planning` — Architecture, design, roadmap
- `analysis` — Data analysis, research, investigation
- `debugging` — Bug fixing, troubleshooting
- `documentation` — Writing docs, comments, READMEs
- `general` — Other tasks

### Complexity Tiers

- `trivial` (0.0-0.3) → `swarm-light`
- `simple` (0.3-0.5) → `swarm-light`
- `moderate` (0.5-0.7) → `swarm-mid`
- `complex` (0.7-1.0) → `swarm-heavy`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OMNIROUTE_URL` | No | OmniRoute base URL (default: `http://localhost:20128`) |
| `OMNIROUTE_API_KEY` | Yes | API key from OmniRoute `.env` |

## Troubleshooting

### Error: "Failed to fetch combos"

**Cause:** OmniRoute not reachable at `http://localhost:20128`

**Fix:**
```bash
# Check if OmniRoute is running
curl http://localhost:20128/health

# Start OmniRoute if needed
cd /path/to/OmniRoute
bun run dev
```

### Error: "No combos found"

**Cause:** No combos created in OmniRoute

**Fix:**
1. Log into OmniRoute web UI: `http://localhost:20128`
2. Go to Combos tab
3. Create at least one combo (e.g., `swarm-light`, `swarm-mid`, `swarm-heavy`)

### Output: "resolvedCombo": "swarm-mid" (static fallback)

**Cause:** OmniRoute unreachable or returned no combos

**Behavior:** Script falls back to static tier mapping (trivial→light, moderate→mid, complex→heavy)

**Fix:** Check OmniRoute health and combo configuration

## Advanced Usage

### Constrain by Budget

```bash
# Only recommend combos under $2 per 1M tokens
bun tier-resolve.ts --omniroute --budget 2.0 "Optimize the database query"
```

### Prefer Free Models

```bash
# Budget of 0 = free-only
bun tier-resolve.ts --omniroute --budget 0 "Summarize this article"
```

### Override Task Type

```bash
# Force analysis type (even if prompt suggests coding)
bun tier-resolve.ts --omniroute --task-type analysis "Fix the performance issue"
```

### Latency-Sensitive Tasks

```bash
# Prefer fast-tier models
bun tier-resolve.ts --omniroute --latency fast "Generate a quick summary"
```

## Integration with Personas

Add a rule to any persona:

**Condition:** When routing a task to OmniRoute or selecting a swarm combo

**Rule:** Before routing any task, run `bun /home/workspace/Skills/omniroute-tier-resolver/scripts/tier-resolve.ts --omniroute "<task>"` to get the recommended combo. Use the `resolvedCombo` from the output as the model/combo name.

## Differences from Swarm Orchestrator

| Feature | Swarm Orchestrator | Tier Resolver Skill |
|---------|-------------------|---------------------|
| **Purpose** | Full DAG-based multi-agent orchestration | Single-task combo recommendation |
| **Dependencies** | Requires executor bridges, memory system | Standalone (only needs OmniRoute) |
| **Output** | Executes tasks and returns results | Returns combo recommendation |
| **Use case** | Parallel agent coordination | Pre-flight model selection |
| **Complexity** | ~2000 lines, 4 executors, circuit breaker | ~400 lines, pure analysis |

## When to Use

✅ **Use tier-resolver when:**
- You need a quick model recommendation for a single task
- You're building a custom routing system
- Your personas need to self-select optimal models
- You want OmniRoute integration without full swarm orchestrator

❌ **Use swarm-orchestrator when:**
- You need to coordinate multiple agents with dependencies
- Tasks require DAG execution, circuit breakers, retries
- You want persistent memory and cognitive profiles
- You need local executor bridges (Claude Code, Hermes, etc.)

## Files

```
Skills/omniroute-tier-resolver/
├── SKILL.md                    # This file
├── scripts/
│   └── tier-resolve.ts         # Main CLI tool
└── references/
    └── complexity-algorithm.md # Complexity scoring details
```

## Version History

- **1.0.0** (2026-03-18) — Initial release, extracted from swarm orchestrator v4.5
