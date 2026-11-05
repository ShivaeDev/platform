import { Effect } from "effect";
import type { EngineState } from "#adapters/initializeEngine.ts";
import { sweepSpawnedDescendants } from "#adapters/threadSweep.ts";

export function census(state: Pick<EngineState, "claims" | "read">) {
	return Effect.fn("CodexEngine.census")((rootThreadId: string) =>
		sweepSpawnedDescendants(state.read, rootThreadId).pipe(
			Effect.tap((children) =>
				Effect.sync(() => {
					for (const child of children) {
						state.claims.claim(rootThreadId, child.threadId);
					}
				}),
			),
		),
	);
}
