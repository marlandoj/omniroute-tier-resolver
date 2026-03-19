#!/usr/bin/env bun

import { resolve } from "path";
import { $ } from "bun";

const SCRIPT_PATH = resolve(import.meta.dir, "../scripts/tier-resolve-v2.ts");
const TEST_SUITE = resolve(import.meta.dir, "test-suite.jsonl");

interface TestCase {
  id: number;
  task: string;
  expectedTier: string;
  expectedType: string;
  rationale: string;
}

interface TestResult {
  id: number;
  task: string;
  expectedTier: string;
  actualTier: string;
  expectedType: string;
  actualType: string;
  match: boolean;
  typeMatch: boolean;
  performanceMs: number;
}

async function runTests() {
  const testFile = Bun.file(TEST_SUITE);
  const content = await testFile.text();
  const tests: TestCase[] = content.trim().split("\n").map(line => JSON.parse(line));
  
  console.log(`Running ${tests.length} test cases...\n`);
  
  const results: TestResult[] = [];
  let correct = 0;
  let typeCorrect = 0;
  
  for (const test of tests) {
    const startTime = Bun.nanoseconds();
    
    try {
      const output = await $`bun ${SCRIPT_PATH} --json ${test.task}`.quiet().text();
      const parsed = JSON.parse(output);
      
      const elapsedMs = (Bun.nanoseconds() - startTime) / 1_000_000;
      
      const match = parsed.tier === test.expectedTier;
      const typeMatch = parsed.inferredTaskType === test.expectedType;
      
      if (match) correct++;
      if (typeMatch) typeCorrect++;
      
      results.push({
        id: test.id,
        task: test.task,
        expectedTier: test.expectedTier,
        actualTier: parsed.tier,
        expectedType: test.expectedType,
        actualType: parsed.inferredTaskType,
        match,
        typeMatch,
        performanceMs: elapsedMs,
      });
      
      const status = match ? "✓" : "✗";
      const typeStatus = typeMatch ? "✓" : "✗";
      console.log(`[${test.id}] ${status} Tier: ${parsed.tier} (expected ${test.expectedTier}) | ${typeStatus} Type: ${parsed.inferredTaskType}`);
      
    } catch (err: any) {
      console.error(`[${test.id}] ERROR: ${err.message}`);
      results.push({
        id: test.id,
        task: test.task,
        expectedTier: test.expectedTier,
        actualTier: "ERROR",
        expectedType: test.expectedType,
        actualType: "ERROR",
        match: false,
        typeMatch: false,
        performanceMs: 0,
      });
    }
  }
  
  const tierAccuracy = (correct / tests.length) * 100;
  const typeAccuracy = (typeCorrect / tests.length) * 100;
  const avgPerformance = results.reduce((sum, r) => sum + r.performanceMs, 0) / results.length;
  const maxPerformance = Math.max(...results.map(r => r.performanceMs));
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULTS`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Tier Accuracy: ${tierAccuracy.toFixed(1)}% (${correct}/${tests.length})`);
  console.log(`Type Accuracy: ${typeAccuracy.toFixed(1)}% (${typeCorrect}/${tests.length})`);
  console.log(`Performance: avg ${avgPerformance.toFixed(1)}ms, max ${maxPerformance.toFixed(1)}ms`);
  console.log(`${"=".repeat(60)}\n`);
  
  // Confusion matrix for tiers
  const tiers = ["trivial", "simple", "moderate", "complex"];
  const matrix: Record<string, Record<string, number>> = {};
  for (const t1 of tiers) {
    matrix[t1] = {};
    for (const t2 of tiers) {
      matrix[t1][t2] = 0;
    }
  }
  
  for (const result of results) {
    if (result.actualTier !== "ERROR") {
      matrix[result.expectedTier][result.actualTier]++;
    }
  }
  
  console.log("Confusion Matrix (rows=expected, cols=actual):");
  console.log(`           ${"trivial".padEnd(10)} ${"simple".padEnd(10)} ${"moderate".padEnd(10)} ${"complex".padEnd(10)}`);
  for (const expected of tiers) {
    const row = tiers.map(actual => matrix[expected][actual].toString().padEnd(10)).join(" ");
    console.log(`${expected.padEnd(10)} ${row}`);
  }
  
  // Save results
  const resultsFile = resolve(import.meta.dir, "test-results.json");
  await Bun.write(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: tests.length,
      tierCorrect: correct,
      tierAccuracy,
      typeCorrect,
      typeAccuracy,
      avgPerformanceMs: avgPerformance,
      maxPerformanceMs: maxPerformance,
    },
    confusionMatrix: matrix,
    results,
  }, null, 2));
  
  console.log(`\nResults saved to: ${resultsFile}`);
  
  // Exit with error if accuracy below threshold
  if (tierAccuracy < 80) {
    console.error(`\n⚠ Tier accuracy below 80% threshold`);
    process.exit(1);
  }
  
  console.log(`\n✓ All checks passed`);
}

runTests();
