# OmniRoute Tier Resolver — Quick Start

**For the colleague who just received this skill.**

## Installation (2 minutes)

### 1. Extract the Skill

```bash
cd /home/workspace/Skills
tar -xzf omniroute-tier-resolver-v1.0.0.tar.gz
```

### 2. Verify OmniRoute is Running

```bash
curl http://localhost:20128/health
# Should return: {"status":"ok"} or similar
```

If not running:
```bash
cd /path/to/OmniRoute
bun run dev
```

### 3. Set Your API Key

Get your OmniRoute API key from `/path/to/OmniRoute/.env` (look for `API_KEY_SECRET=...`)

Then add to Zo:
1. Go to [Settings > Advanced](/?t=settings&s=advanced)
2. Click "Add Secret"
3. Key: `OMNIROUTE_API_KEY`
4. Value: `<your-key-from-omniroute-env>`

### 4. Test It

```bash
cd /home/workspace/Skills/omniroute-tier-resolver/scripts
bun tier-resolve.ts "Write a function to calculate fibonacci"
```

**Expected output:** A combo name like `swarm-light` or `swarm-mid`

---

## Usage

### Simple Mode (Just the Combo Name)

```bash
bun tier-resolve.ts "Your task description here"
# Output: swarm-mid
```

Use this when you just need the recommended combo name.

### Full Mode (Complete Analysis)

```bash
bun tier-resolve.ts --omniroute "Your task description here"
```

**Output:**
```json
{
  "complexity": {
    "tier": "moderate",
    "score": 0.64,
    "signals": { ... },
    "inferredTaskType": "coding",
    "staticCombo": "swarm-mid"
  },
  "omniroute": {
    "recommendedCombo": { ... },
    "alternatives": [ ... ]
  },
  "resolvedCombo": "swarm-mid"
}
```

Use this when you want full diagnostic info.

---

## Integration with Your Personas

### Add a Rule

1. Go to [Settings > AI > Rules](/?t=settings&s=your-ai&d=rules)
2. Create new rule:

**Condition:** When routing a task to OmniRoute

**Instruction:**
```
Before routing any task through OmniRoute, run:
bun /home/workspace/Skills/omniroute-tier-resolver/scripts/tier-resolve.ts --omniroute "<task>"

Use the resolvedCombo field from the JSON output as the model name.
```

### Example in a Persona Prompt

```
When a task requires OmniRoute routing:
1. Run tier-resolve.ts to get the recommended combo
2. Use that combo name as the model parameter
3. Make the OmniRoute API call

Example:
Task: "Analyze user feedback from the past week"
→ Run: bun tier-resolve.ts --omniroute "Analyze user feedback from the past week"
→ Get: { resolvedCombo: "swarm-mid" }
→ Call OmniRoute with model: "swarm-mid"
```

---

## CLI Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--omniroute` | Full JSON output | `--omniroute "task"` |
| `--json` | JSON complexity only | `--json "task"` |
| `--budget <n>` | Max cost per 1M tokens | `--budget 2.0` |
| `--latency <tier>` | Prefer fast/balanced/quality | `--latency fast` |
| `--task-type <type>` | Override inferred type | `--task-type coding` |

---

## Examples

### Budget-Constrained

```bash
# Only recommend combos under $2 per 1M tokens
bun tier-resolve.ts --omniroute --budget 2.0 "Complex analysis task"
```

### Free Models Only

```bash
# Only recommend free combos
bun tier-resolve.ts --omniroute --budget 0 "Simple summary"
```

### Force Task Type

```bash
# Override automatic task type detection
bun tier-resolve.ts --omniroute --task-type debugging "Performance issue"
```

---

## Programmatic Usage (TypeScript/Bun)

```typescript
const taskPrompt = "Your task here";

// Get recommendation
const { stdout } = await Bun.$`bun /home/workspace/Skills/omniroute-tier-resolver/scripts/tier-resolve.ts --omniroute ${taskPrompt}`;
const result = JSON.parse(stdout);
const comboName = result.resolvedCombo;

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

## Troubleshooting

### Error: "Failed to fetch combos"

**Problem:** OmniRoute not reachable

**Fix:**
```bash
# Check if running
curl http://localhost:20128/health

# Start if needed
cd /path/to/OmniRoute && bun run dev
```

### Error: "No combos found"

**Problem:** No combos created in OmniRoute

**Fix:**
1. Open `http://localhost:20128` in browser
2. Go to Combos tab
3. Create combos (e.g., `swarm-light`, `swarm-mid`, `swarm-heavy`)

### Output shows "resolvedCombo": "swarm-mid" (static fallback)

**Problem:** OmniRoute unreachable or auth issue

**What happens:** Script falls back to static tier mapping

**Fix:** Check OmniRoute health and verify API key is set correctly

---

## What This Does

**Input:** Task description (string)

**Process:**
1. Analyzes complexity (word count, file references, multi-step indicators)
2. Infers task type (coding/review/planning/analysis/debugging/documentation)
3. Fetches all available combos from OmniRoute
4. Scores each combo based on capability match, cost, and complexity fit
5. Returns best combo

**Output:** Recommended combo name (or full JSON with `--omniroute`)

---

## What This Doesn't Do

❌ Execute tasks (use swarm orchestrator for that)  
❌ Coordinate multiple agents  
❌ Manage retries or circuit breakers  
❌ Store memory or history

This is **just** the combo selection algorithm — lightweight and focused.

---

## Documentation

- **Full docs:** `SKILL.md`
- **Algorithm details:** `references/complexity-algorithm.md`
- **Installation guide:** `README.md`
- **Shipping guide:** `/home/workspace/Skills/SHIP-TO-COLLEAGUE.md`

---

## Support

Questions? Check the docs above or test with `--omniroute` flag to see full diagnostic output.

**Version:** 1.0.0 (2026-03-18)
