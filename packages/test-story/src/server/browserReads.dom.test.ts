import { expect } from "vitest";
import { readPage } from "#test/readPage.ts";

readPage.it("counts the page's subscription on one shared socket after load", [], ({ readCount, reads, hints, socketAddresses, socketUrl, text }) => {
	expect(text()).toBe("First page");
	const expectedReads = [{ kind: "subscription", payload: { queries: [{ payload: { id: 1 }, query: "get" }] }, tag: "page.$changes" }];
	expect(readCount()).toBe(expectedReads.length);
	expect(socketAddresses()).toEqual([socketUrl()]);
	expect(reads()).toEqual(expect.arrayContaining(expectedReads));
	expect(hints()).toEqual([{ _tag: "Result", query: "get", queryIndex: 0, value: "First page" }]);
});

readPage.it(
	"a related commit pushes its value without another browser read",
	[],
	function* ({ readCount, watchHints, writeHere, write, nextResult, text }) {
		const updates = yield* watchHints();
		const before = readCount();
		yield* writeHere(2, "Unrelated page");
		expect(readCount()).toBe(before);
		yield* write(1, "Revised page");
		expect(yield* updates.next).toEqual({ _tag: "Result", query: "get", queryIndex: 0, value: "Revised page" });
		expect(yield* nextResult()).toBe("Revised page");
		expect(text()).toBe("Revised page");
		expect(readCount()).toBe(before);
	},
);

readPage.it("buffers a browser hint independently for each watcher", [], function* ({ watchHints, write, hints, nextResult }) {
	const first = yield* watchHints();
	const second = yield* watchHints();

	yield* write(1, "Delivered to both");
	yield* nextResult();

	const expected = { _tag: "Result", query: "get", queryIndex: 0, value: "Delivered to both" };
	expect(yield* first.next).toEqual(expected);
	expect(yield* second.next).toEqual(expected);
	expect(hints()).toEqual([{ _tag: "Result", query: "get", queryIndex: 0, value: "First page" }, expected]);
});
