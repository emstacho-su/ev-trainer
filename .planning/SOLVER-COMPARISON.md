# Solver Comparison: Open-Source Poker Solvers for EV-Trainer

## Purpose

Evaluate free, open-source poker solvers that can replace the deterministic mock solver (`src/lib/engine/mockSolver.ts`) in the ev-trainer project. The selected solver must integrate with the existing `solverAdapter.ts` contract, support preflop and postflop NLHE, and be licensable for a portfolio/personal-use product.

## Evaluation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Game Coverage | High | Preflop + postflop NLHE support |
| WASM Potential | High | Can compile to WebAssembly for browser use |
| License | High | AGPL-3.0, MIT, Apache-2.0, or BSD |
| API/Library Interface | High | Callable as a library, not just CLI |
| Algorithm Quality | Medium | CFR/CFR+ or equivalent, convergence guarantees |
| Maturity | Medium | Stars, contributors, test coverage, documentation |
| Activity | Low | Recent commits, maintained |

---

## Candidates

### 1. b-inary/postflop-solver (Rust, AGPL-3.0)

**GitHub**: https://github.com/b-inary/postflop-solver
**Stars**: 342 | **Forks**: 169 | **Contributors**: ~1

**Overview**: A high-performance postflop NLHE solver written in Rust. The only open-source solver with a proven WASM compilation pipeline. A companion project (wasm-postflop, 558 stars) runs the full solver in-browser with multithreading via Web Workers. A desktop variant (desktop-postflop, 320 stars) uses Tauri.

**Algorithm**: Discounted CFR (DCFR) with gamma=3.0 and strategy reset at power-of-4 iterations. SIMD-accelerated, rayon multithreading, 16-bit compression for memory efficiency.

**Game Types**: Postflop NLHE only (flop, turn, river). Supports bunching effect for 6-max. Does NOT solve preflop.

**Interface**: Rust library (Cargo dependency) with well-documented API and examples. Not a CLI tool -- designed for embedding.

**WASM Support**: YES -- proven and production-tested. wasm-postflop builds 4 WASM modules (range, tree, solver-st, solver-mt) using `wasm-pack`. Uses Comlink for Web Worker communication, Dexie for IndexedDB caching. Live demo at wasm-postflop.pages.dev.

**Performance**: Benchmarked faster than PioSOLVER in native Rust. WASM is ~2x slower than native but still practical for real-time training. Solve times depend on tree complexity (seconds to minutes for typical spots).

**Maturity**: Well-documented, clean API. However, development was suspended October 2023 when the author went commercial. No updates since.

**Existing Integrations**: JbCourtois/PokerTrainer (9 stars, GPL-3.0) is a Rust app built to practice with postflop-solver strategy files -- direct precedent for the ev-trainer use case.

**Risks**:
- Development suspended (Oct 2023). No bug fixes or feature additions expected.
- Postflop only -- requires a separate preflop solution.
- AGPL-3.0 requires source disclosure for network-distributed software. Acceptable for portfolio/personal use; needs commercial license for SaaS.

**Fit for ev-trainer**: Excellent for postflop. The wasm-postflop project is a proven integration blueprint. The solverAdapter contract would need async support and solver configuration parameters (bet tree, ranges, iterations). Canonical hash caching maps directly to this solver's output model.

---

### 2. bupticybee/TexasSolver (C++, AGPL-3.0)

**GitHub**: https://github.com/bupticybee/TexasSolver
**Stars**: 2,364 | **Forks**: 414 | **Contributors**: ~5

**Overview**: A C++ postflop solver with a Qt GUI. Most-starred open-source poker solver. Benchmarked against PioSOLVER with comparable results. Also supports Short Deck (6+).

**Algorithm**: CFR variant aligned with PioSOLVER output quality.

**Game Types**: Postflop NLHE and Short Deck. Flop solver with configurable bet trees.

**Interface**: GUI application (Qt 5.1.0) + console CLI. Can dump strategy to JSON. Some "cross language call" support per README.

**WASM Support**: NO. Qt dependency makes WASM compilation impractical. A GPU variant (TexasSolverGPU) adds CUDA dependency, further complicating portability.

**Performance**: 172s vs PioSOLVER's 242s on a 1-2 bet + allin tree (6 threads). Higher memory usage (1600MB vs 492MB).

**Maturity**: High star count but minimal recent code activity. Last substantive code commit ~Feb 2024.

**Risks**:
- No WASM path. Would require server-side deployment as a CLI subprocess.
- AGPL-3.0 with explicit commercial license requirement for SaaS integration.
- Qt dependency adds significant build complexity.
- No library API -- designed as a standalone application.

**Fit for ev-trainer**: Poor for client-side integration. Could work as a server-side CLI process for precomputing solutions, but the lack of library API and WASM support make it a weak fit for the ev-trainer architecture.

---

### 3. krukah/robopoker (Rust, MIT)

**GitHub**: https://github.com/krukah/robopoker
**Stars**: 195 | **Forks**: 34 | **Contributors**: 2

**Overview**: A modular Rust poker AI framework claiming "functional parity to Pluribus." Published on crates.io as `rbp` with 13 sub-crates covering card evaluation, MCCFR, abstraction, HTTP server, JWT auth, and PostgreSQL persistence.

**Algorithm**: Monte Carlo CFR (MCCFR) with external sampling and dynamic tree construction. Hierarchical k-means clustering for 3.1T poker situations. Earth Mover's Distance via Sinkhorn algorithm for card abstraction.

**Game Types**: Full NLHE including preflop and postflop. Also supports short deck (36-card variant).

**Interface**: Rust library on crates.io. Has dedicated HTTP server crate (`rbp-server`) for analysis API and game hosting. JWT auth crate (`rbp-auth`). PostgreSQL persistence layer.

**WASM Support**: Not explicitly built, but being pure Rust with modular crates, the card evaluation and MCCFR crates are WASM-compatible in principle. Server/PostgreSQL crates would need exclusion.

**Performance**: Claims "fastest open-source hand evaluator" with nanosecond evaluation. Training time required for MCCFR to generate strategies.

**Maturity**: v1.0.0 released February 2026. Actively maintained. Only 2 contributors.

**Risks**:
- Relatively new (v1.0.0 Feb 2026). Small community. Unproven in production.
- MCCFR requires significant training time to generate strategy tables.
- Preflop + postflop coverage is a strength but algorithm quality vs established solvers is unvalidated.

**Fit for ev-trainer**: Strong on paper -- MIT license, Rust, preflop + postflop, HTTP server included. The modular crate structure aligns well with selective WASM compilation. However, maturity concerns and the need for strategy pre-training make it higher-risk than postflop-solver for postflop. Best candidate for preflop solving.

---

### 4. elliottneilclark/rs-poker (Rust, Apache-2.0)

**GitHub**: https://github.com/elliottneilclark/rs-poker
**Stars**: 145 | **Forks**: 44 | **Contributors**: 10

**Overview**: A comprehensive Rust poker library covering hand evaluation, Monte Carlo equity, ICM tournament simulation, CFR solver, and arena simulation. Published on crates.io as `rs_poker`. Very actively maintained with weekly commits.

**Algorithm**: PCFR+ (regret matching with quadratic weighting). Lock-free concurrent game tree. Arena allocator for memory efficiency. Depth-based iteration scheduling.

**Game Types**: Full NLHE and Omaha (PLO4 through PLO7). Hand evaluation, equity calculation, CFR solving, and agent simulation.

**Interface**: Library (`rs_poker` on crates.io) + CLI binary (`rsp`). JSON-configurable agents. Well-documented on docs.rs.

**WASM Support**: Not explicitly provided. Pure Rust with no heavy native dependencies makes WASM feasible for core modules. Hand evaluator uses x86_64 PDEP hardware acceleration that would need WASM fallback paths.

**Performance**: 50M+ hands/sec per core (~20ns per 5-card hand). Parallel exploration via rayon.

**Maturity**: 10 contributors, weekly commits (last: April 6, 2026). Well-tested. Good docs.rs documentation.

**Risks**:
- CFR solver is newer and less battle-tested for production GTO training.
- CFR is integrated with the arena system (agent vs agent) rather than as a standalone "solve this spot" API.
- PDEP reliance needs fallback for WASM.

**Fit for ev-trainer**: Strong for hand evaluation and equity calculations. The CFR solver is promising but less proven than postflop-solver for GTO training specifically. Apache-2.0 license is maximally permissive. Best as a supporting library for hand evaluation and equity, potentially for preflop CFR.

---

### 5. noambrown/poker_solver (Python/C++, MIT)

**GitHub**: https://github.com/noambrown/poker_solver
**Stars**: 147 | **Forks**: 15

**Overview**: From Noam Brown, co-creator of Libratus and Pluribus. Implements multiple CFR variants for poker subgame solving. Educational and reference quality from the world's foremost poker AI researcher.

**Algorithm**: CFR, CFR+, External-sampling MCCFR, Fictitious Play, DCFR. Multiple algorithms in one package for comparison and validation.

**Game Types**: River subgame solver for NLHE. Also includes Kuhn and Leduc poker for algorithm validation.

**Interface**: Python CLI with JSON config for subgame definitions. C++ optimized solver available.

**WASM Support**: NO. Python runtime cannot compile to WASM. C++ version could theoretically use Emscripten but no support exists.

**Performance**: Python version is educational-speed. C++ version is optimized but still requires server-side deployment.

**Maturity**: From a world-class researcher. Algorithm quality is unquestionable. Limited game coverage (river only).

**Risks**:
- River-only solver. No flop or turn solving.
- Python is too slow for real-time training; C++ has no WASM path.
- Best as a reference implementation, not a production solver.

**Fit for ev-trainer**: Poor as a primary solver due to river-only coverage. Excellent as a reference for validating other solver implementations and understanding CFR algorithm variants. MIT license is ideal.

---

### 6. Gongsta/Poker-AI (Python, MIT)

**GitHub**: https://github.com/Gongsta/Poker-AI
**Stars**: 185 | **Forks**: ~30

**Overview**: Python-based CFR implementation with card abstraction (EHS clustering, K-Means) for heads-up NLHE. Includes PyGame GUI for training.

**Algorithm**: Vanilla CFR with card abstraction. Separate preflop and postflop training phases.

**Game Types**: Heads-up NLHE. Preflop and postflop.

**Interface**: Python scripts + PyGame GUI.

**WASM Support**: NO.

**Performance**: Educational-grade. Too slow for production use.

**Maturity**: Personal project. Last significant activity ~2024. Not production-ready.

**Fit for ev-trainer**: Reference implementation only. Good for understanding CFR + card abstraction patterns. Not viable as a production solver.

---

### 7. google-deepmind/open_spiel (C++/Python, Apache-2.0)

**GitHub**: https://github.com/google-deepmind/open_spiel
**Stars**: 5,121 | **Forks**: 1,116

**Overview**: DeepMind's massive game-playing research framework. Includes poker (Kuhn, Leduc, Texas Hold'em) as game environments with CFR, MCCFR, and many other algorithms.

**Game Types**: Includes Texas Hold'em but as a research environment, not a production solver.

**Interface**: C++ core with Python bindings. Heavy framework designed for algorithm research.

**WASM Support**: NO. Massive C++ framework with extensive dependencies.

**Fit for ev-trainer**: Overkill. Extracting a poker solver from this framework would be more work than building one. Useful as a reference for algorithm implementations only.

---

## Comparison Matrix

| Solver | Lang | License | Preflop | Postflop | WASM Ready | API Quality | Active | Stars |
|--------|------|---------|---------|----------|------------|-------------|--------|-------|
| **postflop-solver** | Rust | AGPL-3.0 | No | Yes | **Proven** | Excellent | Suspended | 342 |
| TexasSolver | C++ | AGPL-3.0 | No | Yes | No | CLI only | Minimal | 2,364 |
| **robopoker** | Rust | MIT | Yes | Yes | Feasible | Good (HTTP) | Active | 195 |
| **rs-poker** | Rust | Apache-2.0 | Yes | Yes | Feasible | Good (lib) | Very Active | 145 |
| noambrown/poker_solver | Py/C++ | MIT | No | River only | No | CLI | Active | 147 |
| Gongsta/Poker-AI | Python | MIT | Yes | Yes | No | Scripts | Stale | 185 |
| OpenSpiel | C++/Py | Apache-2.0 | Yes | Yes | No | Framework | Active | 5,121 |

---

## Recommendation

### Primary Solver: b-inary/postflop-solver (Postflop)

**postflop-solver** is the clear choice for postflop integration:

1. **Proven WASM pipeline**: wasm-postflop demonstrates the exact integration pattern ev-trainer needs -- compile to WASM, run in Web Workers, cache results in IndexedDB. No other solver has this.

2. **Performance**: Faster than PioSOLVER natively; practical in WASM. Training spots solve in seconds, not minutes.

3. **Clean library API**: Designed for embedding, not as a standalone app. The Rust API maps cleanly to `solverAdapter.ts`'s `SolverNodeOutput` contract.

4. **Direct precedent**: JbCourtois/PokerTrainer and kmurf1999/HoldemSolver show real integrations with poker training UIs.

5. **License**: AGPL-3.0 is acceptable for a portfolio project with source published on GitHub. If the project goes commercial, a fork pre-suspension or commercial license would be needed.

**Risk mitigation for suspended development**: The codebase is mature and battle-tested. The WASM build pipeline is documented. Fork the repo to ensure availability. The solver algorithm (DCFR) is mathematically complete and does not need ongoing development.

### Preflop Strategy: Precomputed Range Database

Preflop is a "solved" problem at the chart level. Rather than running a solver in real-time for preflop:

1. **Precompute preflop ranges** using the existing `src/lib/solver/` CFR implementation (Phase 1 already built this) or robopoker/rs-poker.
2. **Store as JSON** in the bundled spot packs or a dedicated database table.
3. **Serve instantly** without solver computation -- preflop decisions don't need real-time solving.

This is how every commercial trainer (GTO Wizard, PokerCoaching, etc.) handles preflop: precomputed charts, not live solving.

### Supporting Library: rs-poker (Hand Evaluation + Equity)

**rs-poker** fills gaps that postflop-solver doesn't cover:
- Ultra-fast hand evaluation (50M hands/sec)
- Monte Carlo equity calculations
- Omaha support (future expansion)
- Apache-2.0 license (maximally permissive)
- Very actively maintained

### Integration Architecture

```
                   +------------------+
                   |  solverAdapter   |
                   | (async contract) |
                   +--------+---------+
                            |
              +-------------+-------------+
              |                           |
    +---------v---------+     +-----------v-----------+
    | Preflop Adapter   |     | Postflop Adapter      |
    | (JSON range DB)   |     | (postflop-solver WASM)|
    +---------+---------+     +-----------+-----------+
              |                           |
    +---------v---------+     +-----------v-----------+
    | Precomputed ranges|     | WASM Web Worker       |
    | (bundled JSON)    |     | (client-side solving) |
    +-------------------+     +-----------+-----------+
                                          |
                              +-----------v-----------+
                              | IndexedDB cache       |
                              | (by canonical hash)   |
                              +-----------------------+
```

### Changes Needed to solverAdapter.ts

1. **Make interface async**: `solve(request: SolverRequest): Promise<SolverNodeOutput>`
2. **Add solver configuration**: bet sizing tree, player ranges, iteration count, exploitability target
3. **Add preflop/postflop discriminator**: Route to correct adapter based on street
4. **Add caching layer**: Check IndexedDB/memory cache before calling solver
5. **Add progress callback**: For long-running postflop solves, report iteration progress to UI

### Implementation Sequence

1. Fork postflop-solver and wasm-postflop repositories
2. Build WASM modules in ev-trainer build pipeline (Rust + wasm-pack)
3. Create PostflopSolverAdapter implementing async SolverNodeOutput
4. Create PreflopRangeAdapter serving precomputed JSON ranges
5. Add IndexedDB caching layer keyed by canonical node hash
6. Update UI for async solver calls (loading states, progress indicators)
7. Validate output against mock solver to ensure grading pipeline compatibility

---

## Additional References

| Resource | URL | Relevance |
|----------|-----|-----------|
| wasm-postflop (live demo) | wasm-postflop.pages.dev | Architecture reference |
| desktop-postflop | github.com/b-inary/desktop-postflop | Tauri integration reference |
| JbCourtois/PokerTrainer | github.com/JbCourtois/PokerTrainer | Training app integration precedent |
| kmurf1999/HoldemSolver | github.com/kmurf1999/HoldemSolver | React + Rust WASM reference |
| PO Solve | posolve.com | Commercial WASM solver (architecture reference) |
| postflop-solver API docs | b-inary.github.io/postflop_solver/ | Rust API documentation |
| rs_poker on crates.io | crates.io/crates/rs_poker | Library documentation |
