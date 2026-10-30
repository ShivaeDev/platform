import { expect } from "vitest";
import { changeFeed, feedListens, hasTable } from "#test/changeFeed.ts";

changeFeed.it(
	"a void insert publishes the id the database generated",
	[feedListens(), hasTable("generated")],
	function* ({ insertGeneratedRowVoid, published }) {
		yield* insertGeneratedRowVoid();

		expect(yield* published()).toEqual([["generated", "generated:1"]]);
	},
);

changeFeed.it(
	"versioned void inserts and updates and a versioned delete each publish the document's id",
	[feedListens(), hasTable("documents")],
	function* ({ deleteDocument, insertDocumentVoid, published, renameDocumentVoid }) {
		yield* insertDocumentVoid("Draft");
		yield* renameDocumentVoid("Published");
		yield* deleteDocument();

		expect(yield* published()).toEqual([
			["documents", "documents:1"],
			["documents", "documents:1"],
			["documents", "documents:1"],
		]);
	},
);

changeFeed.it(
	"writes to one composite-keyed row in a transaction publish one stable row key",
	[feedListens(), hasTable("readings")],
	function* ({ changeReadingAmount, deleteReading, inTransaction, insertReading, published }) {
		yield* inTransaction(function* () {
			yield* insertReading("meter", 1, 7);
			yield* changeReadingAmount("meter", 1, 8);
			yield* deleteReading("meter", 1);
		});

		expect(yield* published()).toEqual([["readings", 'readings:["meter","1"]']]);
	},
);
