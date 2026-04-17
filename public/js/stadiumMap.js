class StadiumMap {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.venueData = null;
        this.simState = null;
        this.hoveredZoneId = null;
        this.selectedZoneId = null;
        this.recommendedRoute = null;
        this.bestDestinationId = null;
        
        // Setup Resize and Interactivity
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mouseout', () => {
            this.hoveredZoneId = null;
            document.getElementById('mapTooltip').style.display = 'none';
        });

        // Animation loop
        this.time = 0;
        this.animate();
    }

    resize() {
        // Keep square aspect ratio for the canvas logical size, scale via CSS
        const parent = this.canvas.parentElement;
        this.viewScale = Math.min(parent.clientWidth / 800, parent.clientHeight / 800) * 0.95;
    }

    setVenueData(data) {
        this.venueData = data;
    }

    setSimState(state) {
        this.simState = state;
    }

    setRoute(route, destId) {
        this.recommendedRoute = route;
        this.bestDestinationId = destId;
    }

    setSelectedZone(zoneId) {
        this.selectedZoneId = zoneId;
        this.recommendedRoute = null;
        this.bestDestinationId = null;
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Calculate scale since canvas internal resolving is 800x800 but CSS size changes
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    handleMouseMove(e) {
        if (!this.venueData) return;
        const pos = this.getMousePos(e);
        
        let found = null;
        for (const zone of this.venueData.zones) {
            // Simple circular hit area for zones
            const dx = pos.x - zone.coordinates.x;
            const dy = pos.y - zone.coordinates.y;
            if (Math.sqrt(dx*dx + dy*dy) < 40) { // 40px radius hit area
                found = zone;
                break;
            }
        }
        
        this.hoveredZoneId = found ? found.id : null;
        
        const tooltip = document.getElementById('mapTooltip');
        if (found && this.simState) {
            const zState = this.simState.zones[found.id];
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
            
            tooltip.innerHTML = `
                <h4>${found.name}</h4>
                <div>Type: ${found.type}</div>
                <div>Density: ${(zState.crowdDensity * 100).toFixed(0)}%</div>
                <div>Wait: ${zState.estimatedWaitTime.toFixed(1)} min</div>
            `;
            this.canvas.style.cursor = 'pointer';
        } else {
            tooltip.style.display = 'none';
            this.canvas.style.cursor = 'crosshair';
        }
    }

    handleClick(e) {
        if (this.hoveredZoneId) {
            this.setSelectedZone(this.hoveredZoneId);
            // Dispatch event for UI
            window.dispatchEvent(new CustomEvent('zoneSelected', { detail: { zoneId: this.hoveredZoneId } }));
        }
    }

    getZoneColor(density) {
        if (density < 0.2) return 'rgba(34, 197, 94, 0.7)'; // Green
        if (density < 0.5) return 'rgba(234, 179, 8, 0.7)'; // Yellow
        if (density < 0.8) return 'rgba(249, 115, 22, 0.7)'; // Orange
        return 'rgba(239, 68, 68, 0.7)'; // Red
    }

    animate() {
        this.time++;
        this.draw();
        requestAnimationFrame(() => this.animate());
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw stadium outline
        this.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(50, 50, 700, 700);
        this.ctx.fillStyle = 'rgba(26, 32, 60, 0.3)';
        this.ctx.fillRect(50, 50, 700, 700);
        
        // Pitch/Field
        this.ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
        this.ctx.fillRect(300, 300, 200, 200);

        if (!this.venueData || !this.simState) return;

        // Draw edges (Graph connectivity)
        this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        this.ctx.lineWidth = 2;
        Object.keys(this.venueData.graph).forEach(startId => {
            const startNode = this.venueData.zones.find(z => z.id === startId);
            this.venueData.graph[startId].forEach(targetId => {
                const targetNode = this.venueData.zones.find(z => z.id === targetId);
                if (startNode && targetNode) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(startNode.coordinates.x, startNode.coordinates.y);
                    this.ctx.lineTo(targetNode.coordinates.x, targetNode.coordinates.y);
                    this.ctx.stroke();
                }
            });
        });

        // Draw recommended route if exists
        if (this.recommendedRoute && this.recommendedRoute.length > 1) {
            this.ctx.save();
            this.ctx.strokeStyle = '#00d4ff';
            this.ctx.lineWidth = 4;
            this.ctx.setLineDash([10, 10]);
            this.ctx.lineDashOffset = -this.time * 0.5; // Animate dash
            
            this.ctx.beginPath();
            const startZone = this.venueData.zones.find(z => z.id === this.recommendedRoute[0]);
            this.ctx.moveTo(startZone.coordinates.x, startZone.coordinates.y);
            
            for (let i = 1; i < this.recommendedRoute.length; i++) {
                const node = this.venueData.zones.find(z => z.id === this.recommendedRoute[i]);
                this.ctx.lineTo(node.coordinates.x, node.coordinates.y);
            }
            this.ctx.stroke();
            this.ctx.restore();
        }

        // Draw Zones
        this.venueData.zones.forEach(zone => {
            const state = this.simState.zones[zone.id];
            const density = state ? state.crowdDensity : 0;
            const x = zone.coordinates.x;
            const y = zone.coordinates.y;

            // Draw Heatmap Blob
            const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, 40);
            const color = this.getZoneColor(density);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 50, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw Node Point
            this.ctx.fillStyle = '#1e293b';
            this.ctx.strokeStyle = this.hoveredZoneId === zone.id ? '#fff' : 'rgba(255,255,255,0.4)';
            this.ctx.lineWidth = this.hoveredZoneId === zone.id ? 3 : 2;
            
            // Highlight selected
            if (this.selectedZoneId === zone.id) {
                this.ctx.strokeStyle = '#00d4ff';
                this.ctx.lineWidth = 4;
                // Add pulse
                const pulse = Math.sin(this.time * 0.1) * 5;
                this.ctx.shadowColor = '#00d4ff';
                this.ctx.shadowBlur = 10 + pulse;
            } else if (this.bestDestinationId === zone.id) {
                this.ctx.strokeStyle = '#22c55e';
                this.ctx.lineWidth = 4;
                this.ctx.shadowColor = '#22c55e';
                this.ctx.shadowBlur = 15;
            } else {
                this.ctx.shadowBlur = 0;
            }

            this.ctx.beginPath();
            this.ctx.arc(x, y, 12, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.shadowBlur = 0; // reset

            // Tiny icon or text logic could go here based on zone.type
        });

        // Crowd Particle Simulation (Visual effect)
        this.ctx.fillStyle = 'rgba(255,255,255,0.6)';
        this.venueData.zones.forEach(zone => {
            const state = this.simState.zones[zone.id];
            const activeParticles = Math.floor((state ? state.crowdDensity : 0) * 20);
            
            for(let i=0; i<activeParticles; i++) {
                // Random offset jitter based on time so they don't look static
                const px = zone.coordinates.x + (Math.sin(this.time*0.01 + i*10) * 30);
                const py = zone.coordinates.y + (Math.cos(this.time*0.01 + i*5) * 30);
                this.ctx.beginPath();
                this.ctx.arc(px, py, 1.5, 0, Math.PI*2);
                this.ctx.fill();
            }
        });

    }
}

window.StadiumMap = StadiumMap;
