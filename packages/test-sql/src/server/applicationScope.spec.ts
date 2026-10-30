import { expect } from "vitest";
import { database } from "#test/database.ts";
import { finalizerQueriesClone, isolatedBlockOpen } from "#test/databaseTraits.ts";

database.it(
	"a finalizer that an isolated block registers still queries its clone when the block ends",
	[isolatedBlockOpen(), finalizerQueriesClone("the isolated block")],
	function* ({ end, finalizerQuery }) {
		expect(yield* finalizerQuery()).toBe("not run");

		yield* end("the isolated block", "succeeds");

		expect(yield* finalizerQuery()).toBe("answered 1");
	},
);
