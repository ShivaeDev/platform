import { Effect } from "effect";
import { toPgBossError } from "#server/error.ts";

export function inspectionOperation<A>(run: () => Promise<A>, queue?: string) {
	return Effect.tryPromise({ catch: (error) => toPgBossError("inspect", error, queue), try: run });
}
