class DecisionPanel {
    constructor(appContext) {
        this.appContext = appContext;
        this.btnDecide = document.getElementById('btnDecide');
        this.intentSelect = document.getElementById('intentSelect');
        this.locationSelect = document.getElementById('locationSelect');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.jsonToggleBtn = document.getElementById('btnToggleJson');
        this.jsonOutput = document.getElementById('jsonOutput');

        this.setupListeners();
    }

    setupListeners() {
        this.btnDecide.addEventListener('click', () => this.handleDecisionRequest());
        
        this.jsonToggleBtn.addEventListener('click', () => {
            const isVisible = this.jsonOutput.style.display !== 'none';
            this.jsonOutput.style.display = isVisible ? 'none' : 'block';
            this.jsonToggleBtn.textContent = isVisible ? '📋 View API JSON Response' : 'Hide JSON';
        });

        // Listen for map clicks
        window.addEventListener('zoneSelected', (e) => {
            const zoneId = e.detail.zoneId;
            this.locationSelect.value = zoneId;
        });
    }

    populateLocationDropdown(zones) {
        this.locationSelect.innerHTML = '';
        zones.forEach(zone => {
            const opt = document.createElement('option');
            opt.value = zone.id;
            opt.textContent = `${zone.name} (${zone.type})`;
            this.locationSelect.appendChild(opt);
        });
    }

    async handleDecisionRequest() {
        const intent = this.intentSelect.value;
        const locationId = this.locationSelect.value;

        if (!locationId) {
            alert("Please select a valid location.");
            return;
        }

        this.setLoading(true);

        try {
            const urgency = intent === 'emergency' ? 'high' : 'normal';

            const response = await fetch('/api/decide', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userIntent: intent,
                    currentLocation: { zone: locationId },
                    urgency: urgency,
                    preferences: { avoidCrowds: true }
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to fetch recommendation');
            }

            const data = await response.json();
            this.renderResults(data);
            
            // Tell the app context to update map routes
            this.appContext.updateRouteDisplay(data.recommendedRoute.waypoints, data.bestOption.id);

        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(loading) {
        this.btnDecide.disabled = loading;
        this.btnDecide.querySelector('.loader').style.display = loading ? 'block' : 'none';
        this.btnDecide.querySelector('.btn-text').textContent = loading ? 'Analyzing...' : 'Get Recommendation';
        if(loading) this.resultsContainer.style.display = 'none';
    }

    renderResults(data) {
        const { bestOption, recommendedRoute, reasoning, alternatives, alerts } = data;

        document.getElementById('resBestName').textContent = bestOption.name;
        document.getElementById('resTotal').textContent = bestOption.totalEstimatedTime + ' min';
        document.getElementById('resWalk').textContent = recommendedRoute.estimatedTravelTime + ' min';
        document.getElementById('resWait').textContent = bestOption.estimatedWaitTime + ' min';
        document.getElementById('resDensity').textContent = (bestOption.crowdDensity * 100).toFixed(0) + '%';
        
        document.getElementById('resReasoning').textContent = reasoning;

        const altList = document.getElementById('alternativesList');
        altList.innerHTML = '';
        alternatives.forEach(alt => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="alt-info">
                    <span class="name">${alt.rank}. ${alt.name}</span>
                    <span class="reason">${alt.reason}</span>
                </div>
                <div class="alt-time">${alt.totalEstimatedTime} min</div>
            `;
            altList.appendChild(li);
        });

        this.jsonOutput.textContent = JSON.stringify(data, null, 2);
        this.resultsContainer.style.display = 'flex';
    }
}

window.DecisionPanel = DecisionPanel;
