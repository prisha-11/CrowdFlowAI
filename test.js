const assert = require('assert');
const decisionEngine = require('./engine/decisionEngine');

async function runTests() {
    console.log("Running simple test suite...");
    
    try {
        // Test Case: Validate core decision flow returns a valid recommendation object
        // 'food' intent from 'zone_entry'
        const result = await decisionEngine.decide('food', 'zone_entry');
        
        assert(result && typeof result === 'object', "Result should be an object");
        assert(result.bestOption && result.bestOption.id, "Result must contain bestOption with an id");
        assert(result.recommendedRoute && Array.isArray(result.recommendedRoute.waypoints), "Result must contain waypoint array");
        assert(result.reasoning && typeof result.reasoning === 'string', "Result must contain reasoning string");
        assert(result.alternatives && Array.isArray(result.alternatives), "Result must contain alternatives array");
        
        console.log("✅ Core decision flow returned valid recommendation.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Test failed:", error.message);
        process.exit(1);
    }
}

runTests();
