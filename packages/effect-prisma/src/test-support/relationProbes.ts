import { Effect } from "effect";
import { assertAvailableModelNames } from "#internal/clientLifecycle.ts";
import { fromPrismaPromise } from "#internal/promise.ts";
import { FakeResult } from "#test/FakeResult.ts";

export function relationProbes() {
	return {
		adaptThenable: () => fromPrismaPromise(() => new FakeResult([{ active: true, id: 1 }])),
		assertModelNames: assertAvailableModelNames,
		rejectUnknownPromise: () => Effect.exit(fromPrismaPromise(() => Promise.reject(new Error("unknown")))),
	};
}
