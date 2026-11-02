import { Schema } from "effect";
import { expect } from "vitest";
import { collection } from "#keys.ts";
import { keyStory, rows } from "#test/keyStory.ts";

const other = collection("other", Schema.Number);

keyStory.it(
	"a collection refresh reaches its list, items and buckets and leaves other collections alone",
	[],
	function* ({ watch, invalidateCollection, refreshed }) {
		yield* watch("the list", [rows.list]);
		yield* watch("row 1", [rows.item(1)]);
		yield* watch("alice's rows", [rows.bucket.userId("alice")]);
		yield* watch("another collection", [other.item(1)]);
		expect(refreshed()).toEqual([]);

		yield* invalidateCollection(rows.name);

		expect(refreshed()).toEqual(["the list", "row 1", "alice's rows"]);
	},
);
