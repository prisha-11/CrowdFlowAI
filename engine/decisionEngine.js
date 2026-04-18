const simulationEngine = require('./simulationEngine');
const routeManager = require('./routeManager');
// ==========================================
// GOOGLE GEMINI API INTEGRATION
// Utilizes process.env.GOOGLE_API_KEY
// ==========================================
const { GoogleGenerativeAI } = require("@google/generative-ai");

class DecisionEngine {
    constructor() {
        this.avgWalkSpeed = 80; // meters per minute (approx 5 km/h)
        this.apiKey = process.env.GOOGLE_API_KEY;
        this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
    }

    _getEvaluatedOptions(userIntent, currentLocationId) {
        const state = simulationEngine.getState();
        
        // Determine destination types based on intent
        let targetTypes = [];
        if (userIntent === 'food') targetTypes = ['food'];
        else if (userIntent === 'restroom') targetTypes = ['restroom'];
        else if (userIntent === 'exit') targetTypes = ['entry']; // gates act as exits
        else if (userIntent === 'merchandise') targetTypes = ['merchandise'];
        else if (userIntent === 'first_aid' || userIntent === 'emergency') targetTypes = ['first_aid', 'entry'];
        else if (userIntent === 'seat') targetTypes = ['seating'];

        // Find all potential destinations
        const candidates = routeManager.stadiumData.zones.filter(z => targetTypes.includes(z.type));

        if (candidates.length === 0) {
            throw new Error(`No destinations found for intent: ${userIntent}`);
        }

        const evaluatedOptions = [];
        // Extract features and distances for each candidiate
        for (const target of candidates) {
            if (target.id === currentLocationId) continue;

            const route = routeManager.findRoute(currentLocationId, target.id, state.zones);
            if (!route || route.length === 0) continue;

            const pathDist = routeManager.calculatePathDistance(route);
            const targetState = state.zones[target.id];
            
            const waitTime = targetState.estimatedWaitTime || 0;
            const density = targetState.crowdDensity || 0;

            const baseTravelTimeMin = pathDist / this.avgWalkSpeed;
            
            let routeCongestionPenalty = 0;
            route.forEach(zoneId => {
                if(zoneId !== currentLocationId && zoneId !== target.id) {
                     routeCongestionPenalty += (state.zones[zoneId].crowdDensity * 0.5); 
                }
            });

            const totalEstimatedTime = baseTravelTimeMin + waitTime + routeCongestionPenalty;

            evaluatedOptions.push({
                id: target.id,
                name: target.name,
                zone: target.id,
                type: target.type,
                crowdDensity: Number(density.toFixed(2)),
                estimatedWaitTime: Number(waitTime.toFixed(1)),
                distance: Number(pathDist.toFixed(0)),
                totalEstimatedTime: Number(totalEstimatedTime.toFixed(1)),
                route,
                travelTimeMin: Number((baseTravelTimeMin + routeCongestionPenalty).toFixed(1))
            });
        }
        return evaluatedOptions;
    }

    decideRuleBased(userIntent, currentLocationId, urgency = 'normal', preferences = {}) {
        const state = simulationEngine.getState();
        const startZone = routeManager.getZoneById(currentLocationId);
        
        if (!startZone) {
            throw new Error(`Invalid start location: ${currentLocationId}`);
        }

        const evaluatedOptions = this._getEvaluatedOptions(userIntent, currentLocationId);

        if (evaluatedOptions.length === 0) {
            throw new Error(`No viable routes found.`);
        }

        // Scoring weights
        let w1 = 0.40; // wait time
        let w2 = 0.25; // distance
        let w3 = 0.35; // crowd density

        if (urgency === 'high' || userIntent === 'emergency' || userIntent === 'first_aid') {
            w1 = 0.10; 
            w2 = 0.60; 
            w3 = 0.30; 
        }

        if (preferences.avoidCrowds) {
            w1 = 0.30;
            w2 = 0.20;
            w3 = 0.50; 
        }

        let maxWait = 0.1, maxDist = 0.1, maxDensity = 0.1;

        // Find max for normalization
        evaluatedOptions.forEach(opt => {
            maxWait = Math.max(maxWait, opt.estimatedWaitTime);
            maxDist = Math.max(maxDist, opt.distance);
            maxDensity = Math.max(maxDensity, opt.crowdDensity);
        });

        // Scoring
        evaluatedOptions.forEach(opt => {
            const normWait = opt.estimatedWaitTime / maxWait;
            const normDist = opt.distance / maxDist;
            const normDensity = opt.crowdDensity / maxDensity;

            opt.score = (w1 * normWait) + (w2 * normDist) + (w3 * normDensity);
        });

        // Sort by score ascending (lower is better)
        evaluatedOptions.sort((a, b) => a.score - b.score);

        const best = evaluatedOptions[0];
        
        // Generate reasoning
        let reasoning = `${best.name} offers the best balance for your request. `;
        if (best.crowdDensity < 0.5) {
            reasoning += `It has relatively low crowd density (${Math.round(best.crowdDensity * 100)}%) and an estimated wait of ${best.estimatedWaitTime.toFixed(1)} mins. `;
        } else {
            reasoning += `While somewhat crowded (${Math.round(best.crowdDensity * 100)}%), it's the optimal choice based on availability. `;
        }

        if (evaluatedOptions.length > 1) {
            const secondBest = evaluatedOptions[1];
            if (secondBest.distance < best.distance) {
                reasoning += `Although ${secondBest.name} is closer, its current conditions would result in a longer overall wait or dangerous crowding. `;
            }
        }

        const alternatives = evaluatedOptions.slice(1, 4).map((opt, idx) => ({
            rank: idx + 2,
            id: opt.id,
            name: opt.name,
            totalEstimatedTime: opt.totalEstimatedTime,
            crowdDensity: opt.crowdDensity,
            reason: opt.distance < best.distance ? "Closer but significantly worse conditions" : "Moderate conditions but farther distance"
        }));

        return {
            bestOption: {
                id: best.id,
                name: best.name,
                zone: best.zone,
                type: best.type,
                crowdDensity: best.crowdDensity,
                estimatedWaitTime: best.estimatedWaitTime,
                distance: best.distance,
                totalEstimatedTime: best.totalEstimatedTime
            },
            recommendedRoute: {
                waypoints: best.route,
                estimatedTravelTime: best.travelTimeMin,
                congestionLevel: best.crowdDensity > 0.7 ? "high" : best.crowdDensity > 0.4 ? "medium" : "low",
                avoidedZones: [] 
            },
            reasoning,
            alternatives,
            alerts: state.zones[best.id].crowdDensity > 0.85 ? ["Warning: Destination is currently at high capacity."] : [],
            timestamp: new Date().toISOString(),
            engine: "Rule-Based" // Indicate fallback or regular rule-based
        };
    }

    _buildAIPrompt(userIntent, currentLocationId, urgency, evaluatedOptions, state) {
        const optionsForPrompt = evaluatedOptions.map(opt => ({
            id: opt.id,
            name: opt.name,
            type: opt.type,
            crowdDensity: opt.crowdDensity,
            estimatedWaitTime: opt.estimatedWaitTime,
            distance: opt.distance,
            totalEstimatedTime: opt.totalEstimatedTime
        }));

        return `You are an AI CrowdFlow Decision Engine for stadium environments, where users face overcrowding, long wait times, and inefficient movement.
Current Event Phase: ${state.phase}
User Intent: ${userIntent}
Urgency: ${urgency}
Current Location ID: ${currentLocationId}
Options: ${JSON.stringify(optionsForPrompt)}

Analyze all options and select the optimal one.
Rules:
- Minimize total time (travel + wait).
- Avoid congestion (high crowd density).
- Scenario logic:
  - pre-event: prioritize minimal walking.
  - active match: balance all factors normally.
  - halftime: avoid crowded food/restroom areas.
  - post-event: prioritize efficient exits.
  - emergency: override everything to choose the fastest and safest exit.

Output JSON only. Ensure bestOptionId corresponds to an option in the list. Provide alternative IDs and a short reason for each alternative.`;
    }

    async _invokeGeminiModel(prompt) {
        if (!this.genAI) {
            throw new Error("Gemini AI is not initialized (missing API Key).");
        }

        const model = this.genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "object",
                    properties: {
                        bestOptionId: { type: "string" },
                        reasoning: { type: "string" },
                        alternatives: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                    reason: { type: "string" }
                                },
                                required: ["id", "reason"]
                            }
                        }
                    },
                    required: ["bestOptionId", "reasoning", "alternatives"]
                }
            }
        });

        console.log(`[AI Decision Engine] Invoking Gemini model for decision...`);
        const result = await model.generateContent(prompt);
        return result.response.text();
    }

    _parseAIResponse(text, evaluatedOptions, state) {
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(text);
        } catch (e) {
            console.error("[AI Decision Engine] Failed to parse JSON response:", text);
            throw new Error("Malformed JSON response from AI");
        }
        
        console.log(`[AI Decision Engine] Received properly formatted JSON response.`);

        const bestId = jsonResponse.bestOptionId;
        let bestOpt = evaluatedOptions.find(o => o.id === bestId);
        if (!bestOpt) {
            console.warn(`[AI Decision Engine] AI suggested invalid destination ID: ${bestId}. Defaulting to safest rule-base option.`);
            bestOpt = evaluatedOptions[0];
        }

        const alternatives = [];
        let rank = 2;
        for (const alt of jsonResponse.alternatives) {
            const altOpt = evaluatedOptions.find(o => o.id === alt.id);
            if (altOpt && altOpt.id !== bestOpt.id) {
                alternatives.push({
                    rank: rank++,
                    id: altOpt.id,
                    name: altOpt.name,
                    totalEstimatedTime: altOpt.totalEstimatedTime,
                    crowdDensity: altOpt.crowdDensity,
                    reason: alt.reason
                });
            }
        }

        return {
            bestOption: {
                id: bestOpt.id,
                name: bestOpt.name,
                zone: bestOpt.zone,
                type: bestOpt.type,
                crowdDensity: bestOpt.crowdDensity,
                estimatedWaitTime: bestOpt.estimatedWaitTime,
                distance: bestOpt.distance,
                totalEstimatedTime: bestOpt.totalEstimatedTime
            },
            recommendedRoute: {
                waypoints: bestOpt.route,
                estimatedTravelTime: bestOpt.travelTimeMin,
                congestionLevel: bestOpt.crowdDensity > 0.7 ? "high" : bestOpt.crowdDensity > 0.4 ? "medium" : "low",
                avoidedZones: [] 
            },
            reasoning: jsonResponse.reasoning,
            alternatives: alternatives.slice(0, 3),
            alerts: state.zones[bestOpt.id].crowdDensity > 0.85 ? ["Warning: Destination is currently at high capacity."] : [],
            timestamp: new Date().toISOString(),
            engine: "AI"
        };
    }

    async decideAI(userIntent, currentLocationId, urgency, preferences, evaluatedOptions, state) {
        const prompt = this._buildAIPrompt(userIntent, currentLocationId, urgency, evaluatedOptions, state);
        const textResponse = await this._invokeGeminiModel(prompt);
        return this._parseAIResponse(textResponse, evaluatedOptions, state);
    }

    async decide(userIntent, currentLocationId, urgency = 'normal', preferences = {}) {
        const state = simulationEngine.getState();
        const startZone = routeManager.getZoneById(currentLocationId);
        
        if (!startZone) {
            throw new Error(`Invalid start location: ${currentLocationId}`);
        }

        const evaluatedOptions = this._getEvaluatedOptions(userIntent, currentLocationId);

        if (evaluatedOptions.length === 0) {
            throw new Error(`No viable routes found.`);
        }

        try {
            return await this.decideAI(userIntent, currentLocationId, urgency, preferences, evaluatedOptions, state);
        } catch (error) {
            console.warn(`[Decision Engine] AI decision failed, falling back to rule-based: ${error.message}`);
            return this.decideRuleBased(userIntent, currentLocationId, urgency, preferences);
        }
    }
}

module.exports = new DecisionEngine();
