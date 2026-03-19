# Lessons Learned: Complexity Enhancement Sprint

**Date:** 2026-03-18  
**Session:** Spec → Execute → Evaluate cycle for tier-resolve v2 enhancement  
**Outcome:** Implementation complete, evaluation revealed systemic issues

---

## What Went Well ✅

### 1. **Spec-First Interview Process**
- Caught critical design decisions early (breaking changes OK, local-only inference, feedback priority)
- Seed specification prevented scope creep (6 capabilities clearly defined)
- Constraint clarification (explicit > inferred > default) saved rework

### 2. **Systematic Bug Discovery Through Testing**
- Test suite immediately exposed the 16% accuracy issue
- Confusion matrix showed clear pattern (everything classified as "trivial")
- Performance metrics identified the 170ms vs 100ms gap early

### 3. **Incremental Fix Strategy**
- Fixed 5 distinct bugs in sequence (domain detection, scope modifiers, normalization, multi-step, thresholds)
- Each fix verified independently before moving to next
- Clear bug tracker maintained throughout

### 4. **Architecture Wins**
- Feedback system with auto-tune designed correctly from the start
- Constraint priority chain (explicit > inferred > default) elegant and extensible
- Semantic inference with local-only requirement met (no external API deps)

---

## What Went Wrong ❌

### 1. **Testing Too Late**
**Issue:** Built entire v2 implementation (~1,060 lines) before running comprehensive tests  
**Impact:** Discovered fundamental scoring issue AFTER implementation complete  
**Better approach:** Build test suite FIRST, then implement to pass tests (TDD)

### 2. **Missed the Real Problem**
**Issue:** Fixed 5 individual bugs but missed the systemic issue (score compression from equal weights + normalization ceiling)  
**Impact:** 2 hours debugging symptoms, not root cause  
**Better approach:** After 2-3 bug fixes with no accuracy improvement, step back and question the architecture

### 3. **No Baseline Measurement**
**Issue:** No v1 accuracy baseline to compare against  
**Impact:** Can't tell if v2 is better/worse than v1, only that it's bad in absolute terms  
**Better approach:** Run test suite against BOTH v1 and v2 for comparison

### 4. **Performance Not Profiled**
**Issue:** 170ms average (70ms over budget) but no breakdown of where time is spent  
**Impact:** Can't optimize effectively without knowing bottlenecks  
**Better approach:** Add timing markers for each phase (signal computation, domain detection, semantic inference, etc.)

### 5. **Premature Optimization of Complexity**
**Issue:** Went from 5 binary signals → 7 weighted continuous signals with domain modifiers + constraints + scope in one jump  
**Impact:** Too many variables changed at once, hard to isolate what's broken  
**Better approach:** Incremental complexity (v1.1 = weighted only, v1.2 = + domain, v1.3 = + constraints, etc.)

---

## Tactical Mistakes

### 1. **Didn't Validate Test Expectations**
- Assumed the 25 test cases had "correct" tier labels
- "Design microservices architecture..." might genuinely be ambiguous (is it trivial planning or complex execution?)
- Should have reviewed/challenged test expectations before debugging

### 2. **Token Budget Awareness**
- Started evaluation phase with ~140k tokens remaining
- By end of debugging loop, down to ~120k
- Should have timebox evaluation or escalated sooner when stuck

### 3. **Commit Hygiene**
- All work in one file (tier-resolve-v2.ts)
- No git commits during development (only at end)
- Harder to rollback/compare intermediate states

---

## Architectural Insights

### 1. **Equal Weight Initialization is Fragile**
- Starting all weights at 0.14-0.15 assumes all signals are equally important
- In reality: domain/tech stack probably 3x more predictive than word count
- **Lesson:** Use domain knowledge for initial weights, not uniform distribution

### 2. **Normalization Creates Score Compression**
- All signals normalized to [0, 1]
- Weighted sum of 7 signals × 0.14 each = max score ~1.0 if all signals fire
- But rare for ALL signals to fire → most scores cluster 0.1-0.4
- **Lesson:** Normalization + equal weights + strict thresholds = narrow dynamic range

### 3. **Additive vs Multiplicative Modifiers**
- Fixed scope modifiers from multiplicative (×0.8) to additive (+0.1)
- But for very low base scores (0.02), even +0.1 doesn't help much
- **Lesson:** Modifiers need to scale with score magnitude (hybrid approach?)

### 4. **Test Suite Size**
- 25 test cases = good for smoke testing, too small for statistical confidence
- At 16% accuracy (4/25), margin of error is huge
- **Lesson:** Need 100+ cases for reliable auto-tuning

---

## Process Insights

### 1. **Spec-First Works... With Limits**
- Interview caught design decisions
- BUT didn't catch the fundamental "how do you define complexity?" question
- **Lesson:** Ontological questions ("What IS complex?") need deeper probing than functional requirements

### 2. **Evaluation Stage is Critical**
- Three-stage eval correctly identified failure at Stage 1 (mechanical tests pass, accuracy fails)
- But didn't have time to complete Stage 2 (semantic AC verification) or Stage 3 (consensus)
- **Lesson:** Budget MORE time for evaluation than implementation (it's where truth emerges)

### 3. **When to Stop Debugging**
- Fixed 5 bugs with no accuracy improvement
- Should have stopped after bug #3 and reconsidered approach
- **Lesson:** 3-strike rule—if 3 fixes don't move the needle, the problem is conceptual not tactical

---

## What to Do Tomorrow (5am session)

### Option A: Calibrate v2
1. Run v1 (original tier-resolve.ts) against test suite for baseline
2. If v1 is also bad, test expectations are wrong
3. If v1 is good, use feedback auto-tune to fix v2 weights
4. Document migration path if v2 proves better

### Option B: Abandon v2
1. Keep v1 as-is for production use
2. Archive v2 as experimental branch
3. Extract the useful parts (tech stack patterns, constraint detection) into v1.1
4. Incremental improvement instead of rewrite

### Option C: Redefine Success
1. Maybe 80% tier accuracy is unrealistic from text alone
2. Reframe as "tier suggestion with uncertainty bounds"
3. Add a "confidence" score to recommendations
4. Focus on improving task type accuracy (already 76%)

---

## Key Takeaways

1. **TDD saves time** — Write tests first, implement to spec
2. **Baseline everything** — Can't optimize what you don't measure
3. **Question your tests** — "Ground truth" might be ground assumptions
4. **Stop after 3 failed fixes** — You're solving the wrong problem
5. **Equal weights are lazy** — Use domain knowledge
6. **Evaluation ≥ Implementation** — Budget time accordingly

---

## What's Ready for Use Now

- ✅ Original `tier-resolve.ts` (v1) — Production ready, used in swarms
- ✅ GitHub repo published: https://github.com/marlandoj/omniroute-tier-resolver
- ✅ Renamed combos (swarm-* → light/mid/heavy/failover)
- ⚠️ v2 implementation — Complete but not calibrated

**For swarm orchestrator:** Continue using v1 until calibration complete.

---

**Session end:** 2026-03-18 21:30 MST  
**Resume:** 2026-03-19 05:00 MST  
**Next:** Calibration strategy decision (A/B/C above)
