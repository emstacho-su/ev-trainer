# EV Trainer (Runtime Preview)

## Manual preview
1. Install dependencies: `npm install`
2. Start the Next.js dev server: `npm run dev`
3. Open the local URL printed by Next.js and visit `/train`.
4. Enter a seed + sessionId, then use the Spot Quiz / Hand Play / Targeted Drill / Review tabs.

### Determinism note
Seed and sessionId inputs are required for every request. Reusing the same inputs
replays the same solver outputs and EV grading.
