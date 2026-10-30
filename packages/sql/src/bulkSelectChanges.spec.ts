import { expect } from "vitest";
import { changeFeed, feedListens, hasTable, idsFrom, keysOf } from "#test/changeFeed.ts";

const SOURCES = idsFrom(0, 1001);

for (const operation of ["insertFromSelect", "insertFromSelectOrIgnore"] as const) {
	changeFeed.it(
		`${operation} publishes every copied row key when its selection returns 1001 rows`,
		[feedListens(), hasTable("copies")],
		function* ({ copySources, insertSources, publishedKeys }) {
			yield* insertSources(1001);
			expect(yield* publishedKeys()).toEqual(keysOf("sources", SOURCES));

			yield* copySources(operation);

			expect(yield* publishedKeys()).toEqual([...keysOf("sources", SOURCES), ...keysOf("copies", idsFrom(1, 1001))]);
		},
	);
}

changeFeed.it(
	"a filter that deletes 1001 rows publishes every deleted row key",
	[feedListens(), hasTable("rows")],
	function* ({ deleteParentlessRows, insertRows, publishedKeys }) {
		yield* insertRows(SOURCES);
		expect(yield* publishedKeys()).toEqual(keysOf("rows", SOURCES));

		yield* deleteParentlessRows();

		expect(yield* publishedKeys()).toEqual([...keysOf("rows", SOURCES), ...keysOf("rows", SOURCES)]);
	},
);
