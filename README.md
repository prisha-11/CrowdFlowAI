# CrowdFlowAI

An AI-powered CrowdFlow Decision Engine designed to improve attendee experience in large-scale physical events such as sports stadiums. 

The system intelligently guides users by making context-aware decisions that reduce waiting time, avoid crowded areas, and improve overall flow within the venue.

## Features

- **Interactive Dashboard:** Beautiful dark-themed dashboard built with HTML5 Canvas.
- **Decision Engine:** Evaluates candidate destinations based on:
  - Estimated Wait Time (40%)
  - Route Crowd Density (35%)
  - Physical Distance (25%)
- **Pathfinding:** Uses A* pathfinding incorporating congestion penalties so routes actively avoid heavy crowds.
- **Simulation Engine:** Built-in real-time traffic simulation allowing you to test the logic across Pre-event, Active Match, Halftime, and Emergency scenarios.
- **REST JSON API:** Headless decision engine accessible via `POST /api/decide`.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Architecture

This is a Node.js full-stack application.
- **Frontend**: Vanilla Javascript utilizing HTML5 `<canvas>` for real-time map rendering. No build tools required for the frontend.
- **Backend API**: Express.js serving the `engine/` logic which recalculates state dynamically.
  
  ## Architecture
- Data Layer: Simulation engine
- Decision Layer: Gemini AI + fallback logic
- API Layer: Express server

## Reliability
System includes fallback logic if AI fails and logs decision flow for robustness.

### API Examples

**Request (`POST /api/decide`)**
```json
{
  "userIntent": "food",
  "currentLocation": { "zone": "section_n" },
  "urgency": "normal"
}
```

**Response**
```json
{
  "bestOption": { ... },
  "recommendedRoute": { ... },
  "reasoning": "...",
  "alternatives": [ ... ]
}
```
