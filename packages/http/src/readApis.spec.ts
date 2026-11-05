import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { outsideReply, readApis, withheldRead } from "#test/http-client/readApis.ts";

readApis.it("a repeated search returns the cached success without another outside request", [], function* ({ answer, read, searches }) {
	yield* read();
	expect(yield* answer()).toEqual({ name: "paper" });

	yield* read();

	yield* outcomes([
		["cached answer", answer, { name: "paper" }],
		["outside searches", searches, ["private search"]],
	]);
});

readApis.it("a success expires after its time to live and fetches a fresh answer", [], function* ({ read, searches, timeToLivePasses }) {
	yield* read();

	yield* timeToLivePasses();
	yield* read();

	expect(yield* searches()).toEqual(["private search", "private search"]);
});

readApis.it("different search queries keep separate cached answers", [], function* ({ read, searches }) {
	yield* read("food", "apple");
	yield* read("food", "pear");

	yield* read("food", "apple");

	expect(yield* searches()).toEqual(["apple", "pear"]);
});

readApis.it("the cache evicts the least recently read success at capacity", [], function* ({ read, searches }) {
	yield* read("food", "apple");
	yield* read("food", "pear");
	yield* read("food", "apple");

	yield* read("food", "plum");
	yield* read("food", "pear");

	expect(yield* searches()).toEqual(["apple", "pear", "plum", "pear"]);
});

for (const source of ["food", "usda"] as const) {
	for (const [body, status, failure] of [
		[{ name: "private body" }, 503, "status 503"],
		[{ name: 123 }, 200, "decode"],
		[{ name: "a".repeat(100) }, 200, "body-too-large"],
	] as const) {
		readApis.it(
			`${source} returns a typed ${failure} failure and fetches again on the next search`,
			[outsideReply(body, status)],
			function* ({ answer, read, searches }) {
				yield* read(source);
				expect(yield* answer()).toBe(`${source}: ${failure}`);

				yield* read(source);

				yield* outcomes([
					["source failure", answer, `${source}: ${failure}`],
					["outside searches", searches, ["private search", "private search"]],
				]);
			},
		);
	}
}

for (const phase of ["headers", "body"] as const) {
	readApis.it(
		`a read times out with a typed source failure while the remote withholds ${phase}`,
		[withheldRead(phase)],
		function* ({ deadlinePasses, startRead }) {
			yield* startRead();

			expect(yield* deadlinePasses()).toBe("food: timeout");
		},
	);
}

for (const energy of ["bad", null, { value: 42 }]) {
	readApis.it(`a malformed energy field ${JSON.stringify(energy)} reads as missing`, [outsideReply({ energy, name: "apple" })], function* ({ read }) {
		expect(yield* read()).toEqual({ name: "apple" });
	});
}

readApis.it("a valid optional energy field survives decoding", [outsideReply({ energy: 42, name: "apple" })], function* ({ read }) {
	expect(yield* read()).toEqual({ energy: 42, name: "apple" });
});

readApis.it("the request log records the source and path without query text", [], function* ({ read, recordedLogs, recordedLogText, remoteUrl }) {
	yield* read();

	const url = yield* remoteUrl();
	yield* outcomes([
		["request log", recordedLogs, [{ annotations: { method: "GET", source: "food", url: `${url}/body` }, message: ["Outside API request"] }]],
		["logged query text", recordedLogText, expect.not.stringContaining("private")],
	]);
});

readApis.it("native HTTP tracing redacts the search query value", [], function* ({ read, recordedSpans }) {
	yield* read();

	const spans = yield* recordedSpans();
	expect(spans).toContainEqual(expect.objectContaining({ "http.request.method": "GET", "url.query": "q=REDACTED" }));
	expect(JSON.stringify(spans)).not.toContain("private");
});
