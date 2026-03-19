# OmniRoute Tier Resolver

**Intelligent model combo selection for OmniRoute using the `best_combo_for_task` algorithm.**

A lightweight Zo Computer skill that analyzes task complexity and recommends the optimal OmniRoute combo based on capability matching, cost efficiency, and performance requirements.

---

## What It Does

Given any task prompt, this skill:

1. **Analyzes complexity** — word count, file references, multi-step indicators, tool usage patterns
2. **Infers task type** — coding, review, planning, analysis, debugging, documentation, general
3. **Scores all available combos** — based on capability matching, cost efficiency, and complexity fit
4. **Returns recommendation** — combo name, tier, model list, alternatives, reasoning

Use it to make intelligent routing decisions before sending tasks to OmniRoute, ensuring you use the right model tier for each job.

---

## Quick Start

### Prerequisites

- **Zo Computer** with workspace access
- **OmniRoute** installed and running at `http://localhost:20128`
- **At least one combo** created in OmniRoute (e.g., `swarm-light`, `swarm-mid`, `swarm-heavy`)

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
bun tier-resolve.ts "Write a function to parse JSON"
# Output: swarm-light

# Full JSON output with diagnostics
bun tier-resolve.ts --omniroute "Implement OAuth2 authentication with JWT tokens, refresh rotation, and rate limiting"
# Output: JSON with complexity analysis, combo recommendation, alternatives
```

---

## Usage

### Command-Line Interface

**Basic usage:**
```bash
bun tier-resolve.ts "<your task prompt>"
```

**With full diagnostics:**
```bash
bun tier-resolve.ts --omniroute "<your task prompt>"
```

**Examples:**

```bash
# Simple task → lightweight combo
bun tier-resolve.ts "Fix a typo in the README"
# Output: swarm-light

# Complex task → heavyweight combo
bun tier-resolve.ts "Design and implement a distributed caching system with Redis, handle failover, write tests, and create monitoring dashboards"
# Output: swarm-heavy

# Full diagnostic output
bun tier-resolve.ts --omniroute "Refactor authentication module"
# Output: JSON with reasoning, alternatives, cost estimates
```

### Integration with Personas

Add this rule to any Zo persona to enable automatic tier resolution:

**Rule Name:** OmniRoute Intelligent Routing

**Condition:** When routing a task to OmniRoute or selecting a model combo

**Instruction:**
```
Before routing any task through OmniRoute, run:
bun /home/workspace/Skills/omniroute-tier-resolver/scripts/tier-resolve.ts --omniroute "<task prompt>"

Use the `resolvedCombo` field from the JSON output as the model name for OmniRoute calls.
If OmniRoute is unreachable, the script falls back to static tier mapping (trivial→light, moderate→mid, complex→heavy).
```

### Programmatic Usage

```typescript
// In a script or persona automation
const taskPrompt = "Analyze performance metrics from last week";

// Get recommended combo
const result = await Bun.$`bun Skills/omniroute-tier-resolver/scripts/tier-resolve.ts --omniroute ${taskPrompt}`.json();

const comboName = result.resolvedCombo;         // e.g., "swarm-mid"
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
swarm-mid
```

Just the recommended combo name, suitable for direct use in scripts.

### Full Mode (`--omniroute` flag)

```json
{
  "complexity": {
    "tier": "moderate",
    "score": 0.65,
    "signals": {
      "wordCount": 42,
      "fileCount": 2,
      "hasMultiStep": true,
      "hasTool": true,
      "hasAnalysis": false
    },
    "inferredTaskType": "coding",
    "staticCombo": "swarm-mid"
  },
  "omniroute": {
    "selectedCombo": "swarm-mid",
    "alternatives": ["swarm-light", "swarm-heavy"],
    "reasoning": "Best balance of capability and cost for moderate complexity coding task",
    "models": ["anthropic/claude-3.5-sonnet", "openai/gpt-4"],
    "estimatedCost": 0.0042
  },
  "resolvedCombo": "swarm-mid"
}
```

Full diagnostic output with complexity analysis, reasoning, and alternatives.

---

## How It Works

The tier resolver uses a multi-signal heuristic to estimate task complexity:

| Signal | Weight | Description |
|--------|--------|-------------|
| **Word Count** | Variable | 0-20 words = 0.1, 20-50 = 0.3, 50-100 = 0.5, 100+ = 0.7 |
| **File References** | 0.1 per file | Each path pattern adds 0.1 (max 0.5) |
| **Multi-Step** | 0.2 | Keywords: "first", "then", "after", "step 1", etc. |
| **Tool Usage** | 0.15 | Keywords: "search", "run", "execute", "query", etc. |
| **Analysis Required** | 0.15 | Keywords: "analyze", "investigate", "compare", etc. |

**Complexity tiers:**
- **Trivial** (< 0.3): Single-step, simple tasks → `swarm-light`
- **Moderate** (0.3-0.7): Multi-step, moderate complexity → `swarm-mid`
- **Complex** (> 0.7): Multi-file, analytical, complex → `swarm-heavy`

**Task type inference** helps match tasks to combo capabilities:
- `coding` — Implementation, refactoring, debugging
- `review` — Code review, analysis, feedback
- `planning` — Architecture, design, strategy
- `analysis` — Data analysis, investigation, research
- `documentation` — Writing, editing, documentation
- `general` — Other tasks

See `references/complexity-algorithm.md` for detailed algorithm documentation.

---

## Files Included

```
omniroute-tier-resolver/
├── SKILL.md                    # Full Zo skill documentation
├── README.md                   # This file (usage & installation)
├── QUICK-START.md              # 2-minute setup guide
├── scripts/
│   └── tier-resolve.ts         # Main CLI tool (~400 lines, zero deps)
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

---

## Comparison to Swarm Orchestrator

This skill extracts **just the tier resolution logic** from the full swarm orchestrator:

| Feature | Tier Resolver | Full Swarm Orchestrator |
|---------|---------------|-------------------------|
| **Lines of code** | ~400 | ~2,000 |
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
3. Create at least one combo (e.g., `swarm-light`, `swarm-mid`, `swarm-heavy`)

### Using static fallback

**Symptom:** Output shows `"omnirouteError": "..."` and uses `staticCombo`

**Cause:** OmniRoute unreachable or authentication failed

**Behavior:** Script falls back to static tier mapping (trivial→light, moderate→mid, complex→heavy)

**Fix:**
- Verify OmniRoute is running: `curl http://localhost:20128/health`
- Check API key is set: `echo $OMNIROUTE_API_KEY` (in Zo or shell)
- Review OmniRoute logs for authentication errors

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

**1.0.0** (2026-03-18)  
Initial release, extracted from swarm orchestrator v4.5
