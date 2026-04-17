const fs = require('fs');
const path = require('path');

// Load stadium data
const stadiumData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/stadium.json'), 'utf-8'));
const graph = stadiumData.graph;

function getZoneById(zoneId) {
    return stadiumData.zones.find(z => z.id === zoneId);
}

function calculateDistance(zone1, zone2) {
    if (!zone1 || !zone2) return 0;
    const dx = zone1.coordinates.x - zone2.coordinates.x;
    const dy = zone1.coordinates.y - zone2.coordinates.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Simple A* Pathfinding
function findRoute(startZoneId, endZoneId, zoneStates) {
    const openSet = [startZoneId];
    const cameFrom = {};

    const gScore = {};
    const fScore = {};
    
    // Initialize scores
    Object.keys(graph).forEach(node => {
        gScore[node] = Infinity;
        fScore[node] = Infinity;
    });

    gScore[startZoneId] = 0;
    fScore[startZoneId] = calculateDistance(getZoneById(startZoneId), getZoneById(endZoneId));

    while (openSet.length > 0) {
        // Node in openSet with lowest fScore
        let current = openSet.reduce((minNode, node) => fScore[node] < fScore[minNode] ? node : minNode, openSet[0]);

        if (current === endZoneId) {
            return reconstructPath(cameFrom, current);
        }

        openSet.splice(openSet.indexOf(current), 1);

        for (let neighbor of (graph[current] || [])) {
            // Calculate congestion penalty - distance is penalized based on crowd density
            let density = 0;
            if (zoneStates && zoneStates[neighbor]) {
                density = zoneStates[neighbor].crowdDensity;
            }
            
            // Base distance + congestion penalty
            let dist = calculateDistance(getZoneById(current), getZoneById(neighbor));
            let congestionPenalty = dist * (density * 1.5); // Add up to 150% more "distance" if fully crowded
            
            let tentativeGScore = gScore[current] + dist + congestionPenalty;

            if (tentativeGScore < gScore[neighbor]) {
                cameFrom[neighbor] = current;
                gScore[neighbor] = tentativeGScore;
                fScore[neighbor] = gScore[neighbor] + calculateDistance(getZoneById(neighbor), getZoneById(endZoneId));

                if (!openSet.includes(neighbor)) {
                    openSet.push(neighbor);
                }
            }
        }
    }

    // Path not found
    return [];
}

function reconstructPath(cameFrom, current) {
    const totalPath = [current];
    while (cameFrom[current]) {
        current = cameFrom[current];
        totalPath.unshift(current);
    }
    return totalPath;
}

function calculatePathDistance(path) {
    let dist = 0;
    for (let i = 0; i < path.length - 1; i++) {
        dist += calculateDistance(getZoneById(path[i]), getZoneById(path[i+1]));
    }
    return dist;
}

module.exports = {
    findRoute,
    calculateDistance,
    calculatePathDistance,
    getZoneById,
    stadiumData
};
