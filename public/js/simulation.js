class SimulationController {
    constructor() {
        this.phaseBtns = document.querySelectorAll('.phase-btn');
        this.setupListeners();
    }

    setupListeners() {
        this.phaseBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const phase = e.target.getAttribute('data-phase');
                this.setPhase(phase);
                
                // Update UI active state
                this.phaseBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }

    async setPhase(phase) {
        try {
            await fetch('/api/simulate/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phase })
            });
            document.querySelector('.phase-display').textContent = `⏱ Phase: ${phase}`;
        } catch (error) {
            console.error("Failed to set phase", error);
        }
    }

    updateStats(simState) {
        document.getElementById('statCrowd').textContent = simState.totalAttendees.toLocaleString();
        
        let totalDensity = 0;
        let count = 0;
        Object.values(simState.zones).forEach(z => {
            totalDensity += z.crowdDensity;
            count++;
        });
        
        const avgDensity = count > 0 ? (totalDensity / count) * 100 : 0;
        document.getElementById('statDensity').textContent = avgDensity.toFixed(1) + '%';
    }
}

window.SimulationController = SimulationController;
