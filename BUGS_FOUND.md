# Critical Bugs Found During Evaluation

**Stage 1 (Mechanical) Status:** ✅ PASS  
**Test Suite Run:** ❌ FAIL (16% accuracy)

---

## Bug #1: Domain Pattern Detection Too Restrictive

**File:** `tier-resolve-v2.ts:395`  
**Issue:** `detectDomainPattern()` returns `null` if no tech stack matches, even for security/auth tasks

**Root Cause:**
```typescript
if (detectedTech.length === 0 && !subdomain) return null;
```

This means security tasks like "Implement OAuth2 with JWT, MFA, rate limiting" return `null` domain pattern because:
- "OAuth2", "JWT", "MFA" don't match any TECH_STACK_PATTERNS
- Task type is "coding" but no subdomain keywords detected
- Result: No domainComplexity or techStackDepth signals added
- Weighted score stays near zero → everything classified as "trivial"

**Fix:**
1. Add auth/security patterns to TECH_STACK_PATTERNS:
   ```typescript
   oauth: /\b(oauth|oauth2|openid|oidc)\b/i,
   jwt: /\b(jwt|json web token)\b/i,
   auth: /\b(authentication|authorization|mfa|2fa|saml|sso)\b/i,
   ```

2. Add subdomain detection for security tasks:
   ```typescript
   if (taskType === "security" || /\b(auth|security|encrypt|vulnerability)\b/i.test(lower)) {
     subdomain = "security";
     complexityModifier = 1.4;
   }
   ```

3. Change return logic:
   ```typescript
   // Always return a pattern for recognized task types, even without tech stack
   if (detectedTech.length === 0 && !subdomain && taskType === "general") return null;
   return { domain, subdomain, techStack: detectedTech, complexityModifier };
   ```

---

## Bug #2: Scope Modifiers Using Multiplicative Logic (FIXED)

**Status:** ✅ FIXED in last edit

Changed from `score *= 1.2` to `score += 0.15` (additive adjustments).

---

## Bug #3: Signal Normalization Thresholds Too Conservative

**Issue:** Word count normalized as `(words - 10) / 190` means:
- 20 words → 0.05 score (5%)
- 50 words → 0.21 score (21%)
- 100 words → 0.47 score (47%)

Most tasks are <50 words, so wordCount signal contributes almost nothing.

**Fix:** Adjust normalization ranges to better match real-world task lengths:
```typescript
// Current: normalizeLinear(wordCount, 10, 200)
// Better:  normalizeLinear(wordCount, 5, 80)

// 20 words: (20-5)/75 = 0.20 (20%)
// 50 words: (50-5)/75 = 0.60 (60%)
// 80+ words: 1.0 (100%)
```

---

## Bug #4: Multi-Step Detection Missing Common Patterns

**Issue:** Only detects explicit step markers ("then", "after", "first", "1.") but misses:
- Comma-separated lists: "Build X, add Y, and deploy Z"
- Conjunctions: "Implement A and B with C"
- Implicit sequences: "Create user model. Add authentication. Write tests."

**Fix:** Add heuristics:
```typescript
const commaLists = (lower.match(/,\s+(?:and\s+)?[a-z]/g) || []).length;
const sentences = (lower.match(/\.\s+[A-Z]/g) || []).length;
const multiStepIntensity = stepMarkers + numberedSteps + Math.floor(commaLists / 2) + sentences;
```

---

## Test Suite Results (Before Fixes)

**Tier Accuracy:** 16.0% (4/25 correct)  
**Type Accuracy:** 76.0% (19/25 correct)  
**Performance:** avg 176.9ms, max 230.1ms (⚠ Above 100ms target)

**Confusion Matrix:**
```
             trivial  simple  moderate  complex
trivial         4       0        0        0
simple          6       0        0        0
moderate        5       0        0        0
complex         9       1        0        0
```

**Analysis:** 20/25 tasks classified as "trivial" due to domain detection bug → no complexity signals → near-zero weighted score.

---

## Action Plan

### Immediate (Blocking)
1. Fix Bug #1 (domain detection) - **CRITICAL**
2. Fix Bug #3 (normalization ranges)
3. Fix Bug #4 (multi-step detection)
4. Rerun test suite, target ≥80% accuracy

### Performance Optimization
- Current: 176ms avg (76ms over budget)
- Likely cause: Semantic inference string similarity loops
- Fix: Cache n-grams, limit keyword comparison depth

### After Fixes
- Run full three-stage evaluation
- Update documentation
- Commit to repo

---

## Evaluation Status

**Stage 1: Mechanical** ✅ PASS  
- [x] Build/compile: OK  
- [x] Runtime: OK  
- [x] No syntax errors

**Stage 2: Semantic** ❌ BLOCKED  
- Cannot proceed - critical bugs found in Stage 1 testing

**Stage 3: Consensus** ⏸️ PENDING

---

**Next Step:** Fix bugs 1, 3, 4 then rerun test suite.
