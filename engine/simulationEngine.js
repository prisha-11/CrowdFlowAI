const { stadiumData } = require('./routeManager');

class SimulationEngine {
    constructor() {
        this.currentPhase = 'Pre-event'; // Pre-event, Active, Halftime, Post-event, Emergency
        this.zoneStates = {};
        this.totalAttendees = 0;
        this.initializeStates();
    }

    initializeStates() {
        stadiumData.zones.forEach(zone => {
            this.zoneStates[zone.id] = {
                id: zone.id,
                name: zone.name,
                type: zone.type,
                capacity: zone.capacity,
                currentOccupancy: 0,
                crowdDensity: 0, // 0 to 1
                estimatedWaitTime: 0 // in minutes
            };
        });
    }

    setPhase(phase) {
        if (['Pre-event', 'Active', 'Halftime', 'Post-event', 'Emergency'].includes(phase)) {
            this.currentPhase = phase;
            this.updateSimulation();
        }
    }

    tick() {
        this.updateSimulation();
    }

    updateSimulation() {
        const capacityMultiplier = {
            'Pre-event': 0.4,
            'Active': 0.9,
            'Halftime': 0.95,
            'Post-event': 0.5,
            'Emergency': 1.0
        }[this.currentPhase];

        this.totalAttendees = Math.floor(stadiumData.capacity * capacityMultiplier);
        let attendeesToDistribute = this.totalAttendees;

        // Reset
        Object.values(this.zoneStates).forEach(state => {
            state.currentOccupancy = 0;
        });

        // Distribution logic based on phase
        stadiumData.zones.forEach(zone => {
            let targetOccupancyRatio = 0.1; // Base

            switch (this.currentPhase) {
                case 'Pre-event':
                    if (zone.type === 'entry') targetOccupancyRatio = 0.7 + Math.random() * 0.3;
                    if (zone.type === 'concourse') targetOccupancyRatio = 0.4 + Math.random() * 0.3;
                    if (zone.type === 'food' || zone.type === 'merchandise') targetOccupancyRatio = 0.5 + Math.random() * 0.4;
                    if (zone.type === 'seating') targetOccupancyRatio = 0.1 + Math.random() * 0.2;
                    break;
                case 'Active':
                    if (zone.type === 'entry') targetOccupancyRatio = 0.05;
                    if (zone.type === 'concourse') targetOccupancyRatio = 0.1 + Math.random() * 0.1;
                    if (zone.type === 'food' || zone.type === 'restroom') targetOccupancyRatio = 0.2 + Math.random() * 0.2;
                    if (zone.type === 'seating') targetOccupancyRatio = 0.9 + Math.random() * 0.1;
                    break;
                case 'Halftime':
                    if (zone.type === 'concourse') targetOccupancyRatio = 0.6 + Math.random() * 0.4;
                    if (zone.type === 'food' || zone.type === 'restroom') targetOccupancyRatio = 0.8 + Math.random() * 0.2;
                    if (zone.type === 'seating') targetOccupancyRatio = 0.4 + Math.random() * 0.2;
                    break;
                case 'Post-event':
                    if (zone.type === 'entry') targetOccupancyRatio = 0.8 + Math.random() * 0.2;
                    if (zone.type === 'concourse') targetOccupancyRatio = 0.7 + Math.random() * 0.3;
                    if (zone.type === 'seating') targetOccupancyRatio = 0.2 + Math.random() * 0.2;
                    break;
                case 'Emergency':
                    if (zone.type === 'entry' || zone.type === 'concourse') targetOccupancyRatio = 0.9 + Math.random() * 0.1;
                    if (zone.type === 'seating') targetOccupancyRatio = 0.3 + Math.random() * 0.2;
                    break;
            }

            // Apply ratio, ensuring we don't exceed capacity * 1.1 (slight overcapacity possible in emergency)
            let occupancy = Math.floor(zone.capacity * targetOccupancyRatio);
            
            // Add some jitter
            occupancy += Math.floor((Math.random() - 0.5) * (zone.capacity * 0.1));
            
            if (occupancy < 0) occupancy = 0;
            
            this.zoneStates[zone.id].currentOccupancy = occupancy;
            this.zoneStates[zone.id].crowdDensity = Math.min(1.0, occupancy / zone.capacity);
            
            // Calculate wait time based on type and density
            let baseWait = 0;
            if (zone.type === 'food') baseWait = 1;
            if (zone.type === 'restroom') baseWait = 0.5;
            if (zone.type === 'entry') baseWait = 0.5;
            
            if (baseWait > 0) {
                // Wait time spikes exponentially linearly as density approaches 1
                const densityPenalty = Math.pow(this.zoneStates[zone.id].crowdDensity, 2) * 15; 
                this.zoneStates[zone.id].estimatedWaitTime = baseWait + densityPenalty + (Math.random() * 2);
            } else {
                this.zoneStates[zone.id].estimatedWaitTime = 0;
            }
        });
    }

    getState() {
        return {
            phase: this.currentPhase,
            totalAttendees: this.totalAttendees,
            zones: this.zoneStates
        };
    }
}

module.exports = new SimulationEngine();
