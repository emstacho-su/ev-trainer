import { execFileSync } from "node:child_process";
import type { SolverErrorV2, SolverNodeRequestV2, SolverNodeResponseV2 } from "./solverAdapter";
import type { OpenSpielTransport } from "./openSpielSolver";

export type OpenSpielCommandRunner = (
  command: string,
  args: string[],
  options: { input: string; timeoutMs: number; env: NodeJS.ProcessEnv }
) => string;

export interface OpenSpielServiceTransportConfig {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  runner?: OpenSpielCommandRunner;
}

const defaultRunner: OpenSpielCommandRunner = (command, args, options) =>
  execFileSync(command, args, {
    input: options.input,
    timeout: options.timeoutMs,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    env: options.env,
  });

function toError(
  code: SolverErrorV2["code"],
  message: string,
  request: SolverNodeRequestV2,
  retriable: boolean
): SolverErrorV2 {
  return {
    ok: false,
    code,
    message,
    provider: "openspiel",
    nodeHash: request.nodeHash,
    retriable,
  };
}

export function createOpenSpielServiceTransport(
  config: OpenSpielServiceTransportConfig
): OpenSpielTransport {
  const runner = config.runner ?? defaultRunner;

  return {
    solve(request: SolverNodeRequestV2, options: { timeoutMs: number }): SolverNodeResponseV2 | SolverErrorV2 {
      const payload = JSON.stringify({ request, timeoutMs: options.timeoutMs });
      const env = { ...process.env, ...config.env };
      try {
        const raw = runner(config.command, config.args, {
          input: payload,
          timeoutMs: options.timeoutMs,
          env,
        }).trim();
        const parsed = JSON.parse(raw) as SolverNodeResponseV2 | SolverErrorV2;
        if ((parsed as SolverErrorV2).ok === false) {
          return parsed as SolverErrorV2;
        }
        return parsed as SolverNodeResponseV2;
      } catch (error) {
        const e = error as Error & { code?: string; signal?: string };
        if (e.code === "ETIMEDOUT") {
          return toError("SOLVER_TIMEOUT", "OpenSpiel bridge timed out", request, true);
        }
        if (e.code === "ENOENT") {
          return toError("SOLVER_UNAVAILABLE", `OpenSpiel bridge command not found: ${config.command}`, request, true);
        }
        return toError(
          "INTERNAL_ERROR",
          `OpenSpiel bridge failed: ${e.message ?? "unknown error"}`,
          request,
          false
        );
      }
    },
  };
}
