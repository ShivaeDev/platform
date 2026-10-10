import { Effect, Exit } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { record, storageDatabaseUrl, submitAgainstQuota, withStorage } from "#test/storage.ts";

const integration = it.live.skipIf(storageDatabaseUrl === undefined);

integration("releases terminal execution capacity while retaining paths until accepted completion", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			const first = yield* store.insert({ ...record("board-a", "src/a"), stage: "submitting" }, { maxExecuting: 1 });
			expect(Exit.isFailure(yield* store.insert({ ...record("board-b", "src/b"), stage: "submitting" }, { maxExecuting: 1 }).pipe(Effect.exit))).toBe(
				true,
			);
			const terminal = yield* store.compareAndSet("board-a", first.version, { ...first.value, stage: "terminal" });
			yield* store.insert({ ...record("board-b", "src/b"), stage: "submitting" }, { maxExecuting: 1 });
			expect(Exit.isFailure(yield* store.insert(record("board-c", "src/a")).pipe(Effect.exit))).toBe(true);
			yield* store.compareAndSet("board-a", terminal.version, { ...terminal.value, stage: "completed" });
			yield* store.insert(record("board-c", "src/a"));
		}),
	),
);

integration("atomically admits only one submission against a shared remaining quota observation", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			const first = yield* store.insert(record("board-a", "src/a"));
			const second = yield* store.insert(record("board-b", "src/b"));
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

integration("rechecks prepared full scope and current backlog in the submission transaction", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			const first = yield* store.insert(record("board-a", "src/a"));
			yield* store.reserveForeign("pr-overlap", ["src/a"], { backlog: true, executing: false });
			const overlapping = yield* store
				.compareAndSet("board-a", first.version, { ...first.value, stage: "submitting" }, { maxExecuting: 2, recheckOwnership: true })
				.pipe(Effect.exit);
			expect(Exit.isFailure(overlapping)).toBe(true);
			const unrelated = yield* store.insert(record("board-b", "src/b"));
			const fullBacklog = yield* store
				.compareAndSet("board-b", unrelated.version, { ...unrelated.value, stage: "submitting" }, { maxBacklog: 1 })
				.pipe(Effect.exit);
			expect(Exit.isFailure(fullBacklog)).toBe(true);
			expect((yield* store.load("board-a"))?.value.stage).toBe("prepared");
			expect((yield* store.load("board-b"))?.value.stage).toBe("prepared");
		}),
	),
);
