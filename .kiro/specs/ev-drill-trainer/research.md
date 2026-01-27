# ev-drill-trainer — Research

Created: 2026-01-27T22:31:07Z
Updated: 2026-01-27T22:34:10Z

## Summary
Full discovery performed for a greenfield feature. Primary findings focus on open-source solver feasibility, integration boundaries, and licensing constraints. OpenSpiel offers an Apache-2.0 framework with C++ core + Python bindings and research algorithms, making it a viable base for a solver service, but requires custom poker abstraction work for NLHE. RLCard provides CFR examples but its public CFR walkthroughs are limited to toy poker variants, implying additional work to extend to NLHE. ACPC-based tooling (server + CFR repos) indicates an alternative path built around ACPC game definitions and C++ build pipelines; this is viable but adds operational complexity. Sources captured below.

## Discovery Scope
- Open-source solver options suitable for NLHE with CFR-style algorithms
- Integration models (service vs WASM) for Next.js apps
- Licensing and operational implications

## Research Log

### Open-source solver candidates
- OpenSpiel positions itself as a framework for games and algorithms with a C++ core and Python bindings under Apache 2.0. This makes it suitable for a dedicated solver service boundary but implies we must implement or adapt NLHE abstractions within the framework. (Inference based on framework positioning.)  
  Sources: OpenSpiel documentation.  
  Implication: Choose a service boundary that can host C++/Python and expose a stable adapter API.
- RLCard documents CFR usage in Leduc poker examples. This suggests its out-of-the-box CFR flow is demonstrated on small poker variants, and NLHE would require custom expansion.  
  Sources: RLCard documentation.  
  Implication: If RLCard is chosen, plan for significant extension work or accept a limited MVP domain.
- ACPC server tooling provides a standard matchplay server and build system, and ACPC-aligned CFR repos reference ACPC game definitions and build steps. This indicates a viable alternative stack for solver computation but with additional operational overhead (server process, game files).  
  Sources: ACPC server repository, ACPC CFR buckets repository.  
  Implication: ACPC approach fits a service model and could be swapped in later if OpenSpiel path proves too heavy.

### Integration patterns
- A local solver service avoids shipping heavy native binaries to the browser and keeps deterministic execution on the server.  
  Sources: OpenSpiel (C++/Python core), ACPC server (C++ build).  
  Implication: MVP should use a service boundary; WASM remains a future optimization for portability.

## Architecture Options Evaluated
1) **Service-based solver (recommended for MVP)**  
   - Pros: Handles native dependencies; simpler Next.js integration; easy caching.  
   - Cons: Requires server process management.
2) **WASM-only solver**  
   - Pros: Client-side portability; reduced server load.  
   - Cons: Heavy compile pipeline; limited library support.
3) **Hybrid (service + optional WASM)**  
   - Pros: Incremental path to portability.  
   - Cons: Two runtimes to support.

## Decisions (Proposed)
- **Adopt a service-based solver boundary for MVP**, with OpenSpiel as the first candidate engine, and a fallback plan to ACPC-based tooling if needed.
- **Canonical node hashing and cache versioning** will be enforced at the adapter boundary to decouple solver evolution from app code.

## Risks & Mitigations
- **Risk**: OpenSpiel may not provide a turnkey NLHE no-limit solver.  
  **Mitigation**: Keep abstraction/versioning explicit; retain ACPC fallback path.
- **Risk**: Service process complexity.  
  **Mitigation**: Provide a local dev runner and explicit health checks in the adapter.

## Sources
- OpenSpiel documentation (framework overview, C++ core + Python bindings): https://openspiel.readthedocs.io/en/stable/intro.html  
- OpenSpiel GitHub (Apache-2.0 license): https://github.com/google-deepmind/open_spiel  
- RLCard documentation (CFR example limited to Leduc): https://rlcard.org/getting_started.html  
- ACPC server repository (build + matchplay server): https://github.com/crissilvaeng/acpc-server  
- Open Pure CFR (ACPC game definitions + build): https://github.com/moscow25/open-pure-cfr-buckets
