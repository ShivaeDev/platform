import { Effect, Exit } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { record, storageDatabaseUrl, submitAgainstQuota, withStorage } from "#test/storage.ts";

const integration = it.live.skipIf(storageDatabaseUrl === undefined);

integration("releases execution capacity when execution turns terminal", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			const first = yield* store.insert({ ...record("board-a"), stage: "submitting" }, { maxExecuting: 1 });
			expect(Exit.isFailure(yield* store.insert({ ...record("board-b"), stage: "submitting" }, { maxExecuting: 1 }).pipe(Effect.exit))).toBe(true);
			yield* store.compareAndSet("board-a", first.version, { ...first.value, stage: "terminal" });
			yield* store.insert({ ...record("board-b"), stage: "submitting" }, { maxExecuting: 1 });
		}),
	),
);

integration("atomically admits only one submission against a shared remaining quota observation", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			const first = yield* store.insert(record("board-a"));
			const second = yield* store.insert(record("board-b"));
			const limits = { maxExecuting: 2, quota: { available: 1, observedAt: 100 } };
			const results = yield* Effect.all(
				[first, second].map((entry) => submitAgainstQuota(store, entry, limits).pipe(Effect.exit)),
				{ concurrency: 2 },
			);
			expect(results.filter(Exit.isSuccess)).toHaveLength(1);
			expect(results.filter(Exit.isFailure)).toHaveLength(1);
			expect((yield* store.list()).filter((entry) => entry.value.stage === "submitting")).toHaveLength(1);
		}),
	),
);

integration("rechecks current foreign backlog in the submission transaction", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			yield* store.reserveForeign("pr-backlog", { backlog: true, executing: false });
			const prepared = yield* store.insert(record("board-a"));
			const fullBacklog = yield* store
				.compareAndSet("board-a", prepared.version, { ...prepared.value, stage: "submitting" }, { maxBacklog: 1 })
				.pipe(Effect.exit);
			expect(Exit.isFailure(fullBacklog)).toBe(true);
			expect((yield* store.load("board-a"))?.value.stage).toBe("prepared");
		}),
	),
);
