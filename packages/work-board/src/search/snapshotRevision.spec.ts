import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { listingRace } from "#test/listingRace.ts";

it.live("does not cache an older file listing under a revision that advances during the listing", () =>
	listingRace((read) =>
		Effect.gen(function* () {
			const snapshot = yield* read;
			expect(snapshot.revision).toBe(1);
			expect([...snapshot.model.ids.keys()].sort()).toEqual(["added", "first"]);
			expect(yield* read).toBe(snapshot);
		}),
	),
);
