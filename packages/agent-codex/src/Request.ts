import type { Effect } from "effect";
import type { BackendFailure } from "@shivaedev/agent/failures.ts";
export type Request = (method: string, params: unknown, operationId?: string) => Effect.Effect<unknown, BackendFailure>;
