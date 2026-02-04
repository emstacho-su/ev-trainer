# P1.T7 - OpenSpiel Integration Note (Runtime Path)

Created: 2026-02-04T00:00:00Z
Updated: 2026-02-04T00:00:00Z

## Integration Mode Decision

Chosen mode for P1: `service`

Reason:
- Current runtime pipeline is synchronous and already provider-gated.
- Service mode keeps OpenSpiel runtime dependencies outside the Next.js process boundary.
- Service mode gives predictable timeout and error-code handling at adapter boundary.

### Trade-off Table
| Mode | Pros | Risks | Decision |
|---|---|---|---|
| service | Isolation, operational observability, straightforward timeout/error mapping | Requires local service process | **Chosen for P1** |
| WASM | Single-process deployment, no external process | Build/runtime complexity, uncertain performance for poker game trees | Not chosen for P1 |
| hybrid | Flexible fallback routing | Higher implementation and ops complexity | Not chosen for P1 |

### Fallback Trigger Criteria
- Switch from `service` to `hybrid` only if service startup/health fails repeatedly in local and CI runs.
- Consider WASM only after benchmark evidence shows comparable solve latency and contract fidelity.

## Runtime Adapter Contract
- Runtime passes `CanonicalNode` to OpenSpiel adapter (`openSpielSolve`) through existing `createRuntime` solver boundary.
- Adapter maps canonical node -> `SolverNodeRequestV2`.
- Adapter normalizes solver response via `normalizeSolverActionPolicies`.
- Adapter emits metadata in `SolverNodeOutput.meta`:
  - `provider`, `source`, `nodeHash`, `solveMs`, `solvedAt`
  - `errorCode`, `retriable`, `errorMessage` on failure

## Error Mapping Rules
- `UNSUPPORTED_NODE` -> output status `unsolved`
- `SOLVER_TIMEOUT` -> output status `error`, retriable `true`
- `INVALID_REQUEST`, `SOLVER_UNAVAILABLE`, `INTERNAL_ERROR` -> output status `error`, retriable according to source error

## Local Setup Instructions (Service Adapter)

1. Install Python runtime and OpenSpiel dependency set.
2. Start local solver service process (example command):
   - `python -m openspiel_service --port 8787`
3. Health check command:
   - `curl http://127.0.0.1:8787/healthz`
4. Run project checks:
   - `npm test`
   - `npx tsc --noEmit --pretty false`
   - `npm run build`

Note: P1 implementation currently uses an in-process transport stub that mirrors service behavior and contract normalization; the external process wiring is intentionally isolated behind `OpenSpielTransport`.
