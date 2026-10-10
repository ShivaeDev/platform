import { Effect, Exit } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { record, storageDatabaseUrl, withStorage } from "#test/storage.ts";

const test = it.live.skipIf(storageDatabaseUrl === undefined);
test("concurrent foreign transfers of one PR occupy a single backlog slot", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			yield* Effect.all(
				[store.reserveForeign("pr-one", { backlog: true, executing: false }), store.reserveForeign("pr-one", { backlog: true, executing: false })],
				{ concurrency: 2 },
			);
			expect(yield* store.foreignReservations()).toEqual([{ backlog: true, executing: false, owner: "pr-one" }]);
			expect(Exit.isFailure(yield* store.insert({ ...record("board-a"), stage: "terminal" }, { maxBacklog: 1 }).pipe(Effect.exit))).toBe(true);
			yield* store.insert({ ...record("board-a"), stage: "terminal" }, { maxBacklog: 2 });
		}),
	));
