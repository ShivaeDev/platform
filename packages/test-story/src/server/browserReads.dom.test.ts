import { expect } from "vitest";
import { readPage } from "#test/readPage.ts";

readPage.it(
	"counts the page's query and subscription on one shared socket after load",
	[],
	({ readCount, reads, hints, socketAddresses, socketUrl, text }) => {
		expect(text()).toBe("First page");
		const expectedReads = [
			{ kind: "query", payload: { id: 1 }, tag: "page.get" },
			{ kind: "subscription", payload: { queries: [{ payload: { id: 1 }, query: "get" }] }, tag: "page.$changes" },
		];
		expect(readCount()).toBe(expectedReads.length);
		expect(socketAddresses()).toEqual([socketUrl()]);
		expect(reads()).toEqual(expect.arrayContaining(expectedReads));
		expect(hints()).toEqual([{ _tag: "Resync" }]);
	},
);

readPage.it(
	"keeps the count after an unrelated write and counts one refetch after the related hint reaches the page",
	[],
	function* ({ readCount, reads, watchHints, writeHere, write, nextResult, text }) {
		const hints = yield* watchHints();
		const before = readCount();

		yield* writeHere(2, "Unrelated page");

		expect(readCount()).toBe(before);

		yield* write(1, "Revised page");

		expect(yield* hints.next).toEqual({ _tag: "Changed", keys: [{ _tag: "Item", collection: "pages", id: 1 }] });
		expect(yield* nextResult()).toBe("Revised page");
		expect(text()).toBe("Revised page");
		expect(readCount()).toBe(before + 1);
		const expectedQueries = [
			{ kind: "query", payload: { id: 1 }, tag: "page.get" },
			{ kind: "query", payload: { id: 1 }, tag: "page.get" },
		];
		expect(readCount("page.get")).toBe(expectedQueries.length);
		expect(reads().filter(({ kind }) => kind === "query")).toEqual(expectedQueries);
		expect(reads().at(-1)).toEqual({ kind: "query", payload: { id: 1 }, tag: "page.get" });
	},
);

readPage.it("buffers a browser hint independently for each watcher", [], function* ({ watchHints, write, hints, nextResult }) {
	const first = yield* watchHints();
	const second = yield* watchHints();

	yield* write(1, "Delivered to both");
	yield* nextResult();

	const expected = { _tag: "Changed", keys: [{ _tag: "Item", collection: "pages", id: 1 }] };
	expect(yield* first.next).toEqual(expected);
	expect(yield* second.next).toEqual(expected);
	expect(hints()).toEqual([{ _tag: "Resync" }, expected]);
});
