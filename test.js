const assert = require('assert');
const decisionEngine = require('./engine/decisionEngine');
const simulationEngine = require('./engine/simulationEngine');

async function runTests() {
    console.log("🏃 Running comprehensive test suite...\n");
    let passed = 0;
    let failed = 0;

    const runTestCase = async (name, testFn) => {
        try {
            await testFn();
            console.log(`✅ [PASS] ${name}`);
            passed++;
        } catch(e) {
            console.error(`❌ [FAIL] ${name}\n   Error: ${e.message}`);
            failed++;
        }
    }

    await runTestCase("Scenario: Normal Decision (Food, active match)", async () => {
        simulationEngine.setPhase("Active");
        const result = await decisionEngine.decide('food', 'zone_entry');
        assert(result && result.bestOption && result.bestOption.id, "Missing best option");
        assert(Array.isArray(result.recommendedRoute.waypoints), "Missing waypoints");
        assert(typeof result.totalEstimatedTime === 'number', "Should calculate time");
        assert(result.reasoning && typeof result.reasoning === 'string', "Outputs reasoning");
    });

    await runTestCase("Scenario: Emergency Override", async () => {
        simulationEngine.setPhase("Emergency");
        const result = await decisionEngine.decide('emergency', 'zone_entry');
        assert(result.bestOption.type === 'first_aid' || result.bestOption.type === 'entry', "Emergency didn't route to exit/first aid");
    });
    
    await runTestCase("Scenario: Halftime conditions (Restroom)", async () => {
        simulationEngine.setPhase("Halftime");
        const result = await decisionEngine.decide('restroom', 'zone_entry');
        assert(result && result.bestOption, "Should intelligently handle halftime rush");
    });

    await runTestCase("Edge Case: Missing Inputs Validation", async () => {
        let threw = false;
        try {
             await decisionEngine.decide('', null);
        } catch(e) {
             threw = true;
        }
        assert(threw, "System should throw on empty inputs");
    });

    await runTestCase("Edge Case: Invalid Intent", async () => {
        let threw = false;
        try {
             await decisionEngine.decide('teleport', 'zone_entry');
        } catch(e) {
             threw = true;
        }
        assert(threw, "System should throw on invalid intent");
    });

    await runTestCase("Edge Case: Fallback on AI Failure (Network/Auth error)", async () => {
        const oldKey = decisionEngine.genAI;
        decisionEngine.genAI = null; // simulate failure
        const result = await decisionEngine.decide('seat', 'zone_entry');
        assert(result.engine === "Rule-Based", "Did not fallback correctly to rule-based engine");
        decisionEngine.genAI = oldKey; // restore
    });

    console.log(`\n🎉 Tests completed: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
