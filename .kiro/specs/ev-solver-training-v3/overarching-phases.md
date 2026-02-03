# Overarching Phases - v3

Purpose: single source of truth for the high-level roadmap phases referenced by tasks.

## P1 - Solver Core (4-6 weeks)
- Implement CFR+ algorithm
- Card abstraction layer
- Bet sizing abstraction
- Game tree builder
- Convergence testing
- Benchmark against reference solver outputs

## P2 - UI Foundation (3-4 weeks)
- Next.js project setup alignment
- Poker table component
- Card dealing animations
- Position layout
- Config panel
- Dark theme styling

## P3 - Training Logic (4-5 weeks)
- Preflop mode implementation
- Postflop mode implementation
- Range visualization grid
- Action buttons with EV display
- Hand progression flow
- Decision filtering

## P4 - Backend and Auth (3-4 weeks)
- PostgreSQL schema
- API endpoints
- User authentication
- Session tracking
- Hand history storage
- Deployment path

## P5 - Statistics and Polish (3-4 weeks)
- Stats dashboard
- Performance graphs
- Session history
- Flagged hands review
- Per-spot analytics
- Desktop app packaging

## Working rule
- Each iteration creates a phase-scoped `tasks.md` (e.g., P1 tasks now, P2 tasks after P1 completion).

## Task execution protocol (applies to all phases)
1. Pre-task research (required): gather background context, official docs, and best practices.
2. Refine task-specific DoD/acceptance criteria before implementation.
3. Implement only the scoped task.
4. Run gates and verify explicit task DoD.
5. Commit and push only after DoD + gates pass.

## Git push structure (consistent syntax)
Use this format for every completed task:

```bash
git checkout -b <phase-task-id>-<short-slug>
# implement scoped task
npm test
npx tsc --noEmit --pretty false
npm run build
git add -A
git commit -m "<phase-task-id>: <what was delivered and DoD met>"
git push -u origin <phase-task-id>-<short-slug>
```

Example:
```bash
git checkout -b p1-t1-solver-license-memo
git add -A
git commit -m "P1.T1: add solver commercialization licensing memo (DoD passed)"
git push -u origin p1-t1-solver-license-memo
```
