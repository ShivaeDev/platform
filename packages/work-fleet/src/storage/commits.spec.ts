import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { CommittedSink } from "@shivaedev/effect-sql/transact.ts";
import { postgresTests } from "#test/postgres.ts";
import { record, withStorage } from "#test/storage.ts";

const test = postgresTests("live", "isolated");

test("record, foreign occupancy and initialization writes announce their transaction commits", () =>
	withStorage((store, namespace) =>
		Effect.gen(function* () {
			const hints: (readonly unknown[])[] = [];
			yield* Effect.gen(function* () {
				yield* store.initialize();
				const saved = yield* store.insert(record("one"));
				yield* store.compareAndSet("one", saved.version, { ...saved.value, stage: "running" });
				yield* store.reserveForeign("external");
				yield* store.reserveForeign("external", { backlog: true, executing: false });
				yield* store.releaseForeign("external");
			}).pipe(Effect.provideService(CommittedSink, (changes) => Effect.sync(() => hints.push(changes))));
			expect(hints).toEqual([
				[`${namespace}_records`],
				[`${namespace}_records`],
				[`${namespace}_records`],
				[`${namespace}_foreign_reservations`],
				[`${namespace}_foreign_reservations`],
				[`${namespace}_foreign_reservations`],
			]);
		}),
	));
