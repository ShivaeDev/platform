import { Effect, Result } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { record, storageDatabaseUrl, withStorage } from "#test/storage.ts";

const test = it.live.skipIf(storageDatabaseUrl === undefined);
test("conservative concurrent foreign transfers retain every observed path and one PR backlog", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			yield* store.reserveForeign("pr-one", ["src/original"], { backlog: true, executing: false });
			yield* Effect.all(
				[
					store.reserveForeign("pr-one", ["src/new-a"], { backlog: true, executing: false, preservePaths: true }),
					store.reserveForeign("pr-one", ["src/new-b"], { backlog: true, executing: false, preservePaths: true }),
				],
				{ concurrency: 2 },
			);
			const reservations = yield* store.foreignReservations();
			expect(reservations).toHaveLength(1);
			expect(new Set(reservations[0]?.paths)).toEqual(new Set(["src/original", "src/new-a", "src/new-b"]));
			for (const path of ["src/original", "src/new-a", "src/new-b"]) {
				expect(Result.isFailure(yield* store.insert(record("overlap", path)).pipe(Effect.result))).toBe(true);
			}
			yield* store.insert(record("disjoint", "src/disjoint"));
		}),
	));

test("authoritative foreign replacement can retire an obsolete observed path explicitly", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			yield* store.reserveForeign("pr-one", ["src/old", "src/current"], { backlog: true, executing: false });
			yield* store.reserveForeign("pr-one", ["src/current"], { backlog: true, executing: false });
			expect((yield* store.foreignReservations())[0]?.paths).toEqual(["src/current"]);
			yield* store.insert(record("available", "src/old"));
		}),
	));
