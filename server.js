require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const decisionEngine = require('./engine/decisionEngine');
const simulationEngine = require('./engine/simulationEngine');
const routeManager = require('./engine/routeManager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set up simulation auto-tick interval
setInterval(() => {
    simulationEngine.tick();
}, 2000); // UI polls every 2 seconds, engine updates every 2 seconds to provide smooth changes


// --- API ENDPOINTS ---

// 1. Get Venue Data
app.get('/api/venues', (req, res) => {
    res.json(routeManager.stadiumData);
});

// 2. Get Real-time Simulation State
app.get('/api/simulate', (req, res) => {
    res.json(simulationEngine.getState());
});

// 3. Update Simulation Settings
// Input: { phase: "Halftime" }
app.post('/api/simulate/config', (req, res) => {
    const { phase } = req.body;
    if (phase) {
        simulationEngine.setPhase(phase);
        return res.json({ success: true, phase });
    }
    res.status(400).json({ error: "Invalid phase" });
});

// 4. Decision Engine Core Request
// Input: { userIntent: "food", currentLocation: { zone: "section_n" }, urgency: "normal", preferences: {} }
app.post('/api/decide', async (req, res) => {
    try {
        const { userIntent, currentLocation, urgency, preferences } = req.body;
        
        const allowedIntents = ['food', 'restroom', 'exit', 'merchandise', 'first_aid', 'emergency', 'seat'];
        
        if (typeof userIntent !== 'string' || !allowedIntents.includes(userIntent)) {
            return res.status(400).json({ error: "Invalid or missing userIntent" });
        }
        if (!currentLocation || typeof currentLocation.zone !== 'string') {
            return res.status(400).json({ error: "Invalid or missing currentLocation.zone" });
        }

        const decision = await decisionEngine.decide(
            userIntent, 
            currentLocation.zone, 
            urgency, 
            preferences
        );

        res.json(decision);
    } catch (error) {
        console.error("Decision Engine Error:", error);
        res.status(500).json({ error: error.message || "Internal server error processing decision" });
    }
});


// Start server
app.listen(PORT, () => {
    console.log(`🏟️  CrowdFlowAI Server running on http://localhost:${PORT}`);
});
