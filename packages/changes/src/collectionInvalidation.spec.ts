import { Schema } from "effect";
import { expect } from "vitest";
import { collection } from "#keys.ts";
import { keyStory, rows } from "#test/keyStory.ts";

const other = collection("other", Schema.Number);

for (const context of [undefined, { scope: "alice" }]) {
	keyStory.it(
		`a collection refresh reaches its list, items and buckets within ${context?.scope ?? "global"} scope`,
		[],
		function* ({ watch, invalidateCollection, refreshed }) {
			yield* watch("the list", [rows.list], context);
			yield* watch("row 1", [rows.item(1)], context);
			yield* watch("alice's rows", [rows.bucket.userId("alice")], context);
			yield* watch("another collection", [other.item(1)], context);
			yield* watch("another session", [rows.bucket.userId("alice")], { scope: "bob" });
			expect(refreshed()).toEqual([]);

			yield* invalidateCollection(rows.name, context);

			expect(refreshed()).toEqual(["the list", "row 1", "alice's rows"]);
		},
	);
}
