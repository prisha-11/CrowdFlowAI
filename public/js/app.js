class App {
    constructor() {
        this.stadiumMap = new StadiumMap('stadiumCanvas');
        this.decisionPanel = new DecisionPanel(this);
        this.simController = new SimulationController();
        this.pollInterval = null;

        this.init();
    }

    async init() {
        try {
            // Load initial map data
            const res = await fetch('/api/venues');
            const venueData = await res.json();
            this.stadiumMap.setVenueData(venueData);
            this.decisionPanel.populateLocationDropdown(venueData.zones);

            // Start polling sim state
            this.startPolling();
        } catch (error) {
            console.error("Failed to initialize app", error);
        }
    }

    async fetchSimState() {
        try {
            const res = await fetch('/api/simulate');
            const simState = await res.json();
            
            this.stadiumMap.setSimState(simState);
            this.simController.updateStats(simState);
        } catch (error) {
            console.error("Failed to fetch sim state", error);
        }
    }

    startPolling() {
        this.fetchSimState();
        this.pollInterval = setInterval(() => this.fetchSimState(), 2000);
    }

    updateRouteDisplay(route, destinationId) {
        this.stadiumMap.setRoute(route, destinationId);
    }
}

// Boot up
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
