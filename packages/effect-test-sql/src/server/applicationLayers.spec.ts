import { Effect } from "effect";
import { expect } from "vitest";
import { database } from "#test/database.ts";

database.it(
	"application Layers built inside isolation acquire the clone's client",
	[],
	function* ({ inShared, inClone, buildItems, renameThroughFreshLayer, readItems, readSharedItems }) {
		const shared = yield* inShared(buildItems());
		yield* inClone(
			Effect.gen(function* () {
				yield* shared.rename("shared");
				expect(yield* readItems()).toEqual([{ value: "seed" }]);
				yield* renameThroughFreshLayer("isolated");
				expect(yield* readItems()).toEqual([{ value: "isolated" }]);
			}),
		);
		expect(yield* readSharedItems()).toEqual([{ value: "shared" }]);
	},
);
