# OmniRoute Tier Resolver — Installation & Sharing

Standalone skill for intelligent OmniRoute combo selection using the `best_combo_for_task` algorithm.

## For Your Colleague

Your colleague needs:
1. **OmniRoute installed** and running at `http://localhost:20128`
2. **At least one combo created** in OmniRoute (e.g., `swarm-light`, `swarm-mid`, `swarm-heavy`)
3. **This skill folder** copied to their Zo Computer

---

## Installation Steps

### 1. Copy This Skill

Share the entire `omniroute-tier-resolver/` folder:

```bash
# From your Zo Computer (send via zip, GitHub, or direct file share)
cd /home/workspace/Skills
tar -czf omniroute-tier-resolver.tar.gz omniroute-tier-resolver/

# On colleague's Zo Computer (unpack to Skills directory)
cd /home/workspace/Skills
tar -xzf omniroute-tier-resolver.tar.gz
```

**Or via Git:**

```bash
# Create a repo (optional)
cd /home/workspace/Skills/omniroute-tier-resolver
git init
git add .
git commit -m "Initial commit"

# Colleague clones
cd /home/workspace/Skills
git clone <your-repo-url> omniroute-tier-resolver
```

### 2. Verify OmniRoute

```bash
# Check OmniRoute is running
curl http://localhost:20128/health

# If not running, start OmniRoute
cd /path/to/OmniRoute
bun run dev
```

### 3. Set API Key

The script reads `OMNIROUTE_API_KEY` from environment. Your colleague should either:

**Option A: Set in Zo Secrets** (recommended)
- Go to [Settings > Advanced](/?t=settings&s=advanced)
- Add `OMNIROUTE_API_KEY` with value from OmniRoute `.env` file

**Option B: Export in shell**
```bash
export OMNIROUTE_API_KEY="your-api-key-here"
```

### 4. Test

```bash
cd /home/workspace/Skills/omniroute-tier-resolver/scripts

# Test basic functionality
bun tier-resolve.ts "Write a function to parse JSON"

# Expected output: combo name (e.g., "swarm-mid")

# Test full JSON output
bun tier-resolve.ts --omniroute "Fix authentication bug"

# Expected: JSON with complexity, combo details, alternatives
```

---

## Usage in Personas

Your colleague can add this rule to any persona:

**Rule Name:** OmniRoute Tier Resolution

**Condition:** When routing a task to OmniRoute or selecting a swarm combo

**Instruction:**
```
Before routing any task through OmniRoute, run:
bun /home/workspace/Skills/omniroute-tier-resolver/scripts/tier-resolve.ts --omniroute "<task prompt>"

Use the `resolvedCombo` field from the JSON output as the model name for OmniRoute calls.
```

---

## Quick Integration Example

```typescript
// In a persona prompt or script
const taskPrompt = "Analyze the performance metrics from last week";

// Get recommended combo
const { stdout } = await Bun.$`bun Skills/omniroute-tier-resolver/scripts/tier-resolve.ts --omniroute ${taskPrompt}`;
const result = JSON.parse(stdout);
const comboName = result.resolvedCombo; // e.g., "swarm-mid"

// Call OmniRoute
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

## Files Included

```
omniroute-tier-resolver/
├── SKILL.md                    # Full skill documentation
├── README.md                   # This file (installation guide)
├── scripts/
│   └── tier-resolve.ts         # Main CLI tool (400 lines, zero deps)
└── references/
    └── complexity-algorithm.md # Algorithm details
```

---

## Differences from Swarm Orchestrator

This skill is **much lighter** than the full swarm orchestrator:

| Feature | Tier Resolver | Swarm Orchestrator |
|---------|---------------|-------------------|
| Lines of code | ~400 | ~2000 |
| Dependencies | OmniRoute only | Executor bridges, memory system, DAG engine |
| Purpose | Combo recommendation | Full multi-agent coordination |
| Use case | Pre-flight model selection | Parallel task execution |

Your colleague gets:
- ✅ The `best_combo_for_task` algorithm
- ✅ Complexity analysis
- ✅ Cost-aware routing
- ✅ Budget/latency constraints

They **don't need**:
- ❌ Local executor bridges (Claude Code, Hermes, Gemini, Codex)
- ❌ Memory system integration
- ❌ DAG execution engine
- ❌ Circuit breakers, retries, preflight checks

---

## Troubleshooting

### "Failed to fetch combos"

**Cause:** OmniRoute not reachable

**Fix:**
```bash
curl http://localhost:20128/health
# If 404 or connection refused, start OmniRoute
```

### "No combos found"

**Cause:** No combos created in OmniRoute

**Fix:**
1. Open OmniRoute web UI: `http://localhost:20128`
2. Navigate to Combos tab
3. Create combos (e.g., `swarm-light`, `swarm-mid`, `swarm-heavy`)

### Static fallback ("resolvedCombo": "swarm-mid")

**Cause:** OmniRoute unreachable or returned empty combo list

**Behavior:** Script uses static tier mapping (trivial→light, moderate→mid, complex→heavy)

**Fix:** Check OmniRoute health and combo configuration

---

## Support

For questions or issues:
1. Read `SKILL.md` for full documentation
2. Check `references/complexity-algorithm.md` for algorithm details
3. Test with `--omniroute` flag to see full diagnostic output

---

## Version

**1.0.0** (2026-03-18) — Initial release, extracted from swarm orchestrator v4.5
