import { AIRouter } from "./server/ai_router";

async function runTests() {
  console.log("==================================================");
  console.log("   AI ROUTER FAILOVER & MULTI-LLM INFERENCE TESTS");
  console.log("==================================================");

  const router = AIRouter.getInstance();
  const testPrompt = "Translate the research milestone into precise summaries.";

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(` ✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(` ❌ [FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    // ------------------------------------------------------------------
    // TEST 1: Gemini Success
    // ------------------------------------------------------------------
    console.log("\n[TEST 1] Verifying Primary Path: Gemini Success...");
    router.clearSimulations();
    router.simulateProviderState("gemini", "success");
    
    // We mock/intercept the query generation by activating simulator modes
    const res1 = await router.generate(testPrompt);
    assert(res1.provider === "gemini", `Expected "gemini" as provider, got "${res1.provider}"`);
    assert(res1.response.length > 0, "Expected a valid AI response text string");

    // ------------------------------------------------------------------
    // TEST 2: Gemini Quota Exceeded -> Mistral
    // ------------------------------------------------------------------
    console.log("\n[TEST 2] Verifying Fallback Path: Gemini Quota Exceeded -> Mistral...");
    router.clearSimulations();
    router.simulateProviderState("gemini", "quota_exceeded");
    router.simulateProviderState("mistral", "success");

    const res2 = await router.generate(testPrompt);
    assert(res2.provider === "mistral", `Expected fallback to "mistral", got "${res2.provider}"`);
    assert(res2.response.length > 0, "Expected response content string");

    // ------------------------------------------------------------------
    // TEST 3: Gemini Down -> Mistral
    // ------------------------------------------------------------------
    console.log("\n[TEST 3] Verifying Fallback Path: Gemini Offline -> Mistral...");
    router.clearSimulations();
    router.simulateProviderState("gemini", "down");
    router.simulateProviderState("mistral", "success");

    const res3 = await router.generate(testPrompt);
    assert(res3.provider === "mistral", `Expected fallback to "mistral", got "${res3.provider}"`);
    assert(res3.response.length > 0, "Expected response content string");

    // ------------------------------------------------------------------
    // TEST 4: Gemini Down + Mistral Down -> Groq
    // ------------------------------------------------------------------
    console.log("\n[TEST 4] Verifying Multi-Level Fallback Path: Gemini & Mistral both Offline -> Groq...");
    router.clearSimulations();
    router.simulateProviderState("gemini", "down");
    router.simulateProviderState("mistral", "down");
    router.simulateProviderState("groq", "success");

    const res4 = await router.generate(testPrompt);
    assert(res4.provider === "groq", `Expected fallback to "groq", got "${res4.provider}"`);
    assert(res4.response.length > 0, "Expected response content string");

    // ------------------------------------------------------------------
    // TEST 5: All Providers Down
    // ------------------------------------------------------------------
    console.log("\n[TEST 5] Verifying Recovery Path: All Providers Down gracefully handles...");
    router.clearSimulations();
    router.simulateProviderState("gemini", "down");
    router.simulateProviderState("mistral", "down");
    router.simulateProviderState("groq", "down");

    const res5 = await router.generate(testPrompt);
    assert(res5.provider === "system", `Expected "system" error handler block, got "${res5.provider}"`);
    assert(res5.response === "All AI providers are currently unavailable. Please try again later.", `Expected standard outage message, got: "${res5.response}"`);

    // Clean up simulations
    router.clearSimulations();

    console.log("\n==================================================");
    console.log("             ROUTER TEST RESULTS SUMMARY");
    console.log("==================================================");
    console.log(` Tests Passed: ${passed}`);
    console.log(` Tests Failed: ${failed}`);
    console.log("==================================================");

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log("🎉 ALL MULTI-LLM FALLOVER TESTS COMPLETED SUCCESSFULLY WITH ZERO FLAKINESS!");
      process.exit(0);
    }
  } catch (error) {
    console.error("Critical test runner crash:", error);
    process.exit(1);
  }
}

runTests();
