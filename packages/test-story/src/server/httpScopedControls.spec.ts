import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { scopedHttpApp } from "#test/scopedHttpApp.ts";

const SCOPED_PULL = { params: { number: "7", owner: "a/b", repo: "platform" } };
const PULL_7 = "/repos/team/platform/pulls/7";
const PULL_8 = "/repos/team/platform/pulls/8";

for (const [difference, path] of [
	["another owner", "/repos/other/platform/pulls/7"],
	["another repository", "/repos/a%2Fb/other/pulls/7"],
	["another number", "/repos/a%2Fb/platform/pulls/8"],
] as const) {
	scopedHttpApp.it(`answers a pull with ${difference} normally while a scoped failure waits`, [], function* ({ asks, failOnce }) {
		yield* failOnce("pull", { status: HttpStatus.fromLiteral("ServiceUnavailable") }, SCOPED_PULL);

		expect(yield* asks(path)).toMatch(/^HTTP 200 /u);
	});
}

scopedHttpApp.it("spends a scoped failure on the pull whose decoded parameters all match", [], function* ({ asks, failOnce }) {
	yield* failOnce("pull", { status: HttpStatus.fromLiteral("ServiceUnavailable") }, SCOPED_PULL);

	yield* outcomes({
		"the first matching pull": [asks("/repos/a%2Fb/platform/pulls/7"), "HTTP 503"],
		"the next matching pull": [asks("/repos/a%2Fb/platform/pulls/7"), 'HTTP 200 {"owner":"a/b","repo":"platform","number":"7"}'],
	});
});

scopedHttpApp.it("stalls one pull's body while another pull on the same route finishes", [], function* ({ answer, asks, progress, sends, stall }) {
	const paused = yield* stall("pull", { params: { number: "7" } });
	yield* sends("pull 7", PULL_7);
	yield* paused.waiting;
	yield* outcomes({
		"pull 8": [asks(PULL_8), 'HTTP 200 {"owner":"team","repo":"platform","number":"8"}'],
		"while pull 7": [progress("pull 7"), "waiting for its body"],
	});

	yield* paused.release;

	expect(yield* answer("pull 7")).toBe('HTTP 200 {"owner":"team","repo":"platform","number":"7"}');
});

scopedHttpApp.it("faults only the arrived pull its scope selects", [], function* ({ answer, fault, progress, sends, stall, status }) {
	const paused = yield* stall("pull");
	yield* sends("pull 8", PULL_8);
	yield* paused.waiting;
	yield* sends("pull 7", PULL_7);
	expect(yield* status("pull 7")).toBe("HTTP 200");

	yield* fault("pull", { kind: "reset" }, { params: { number: "7" } });

	yield* outcomes({
		"pull 7": [answer("pull 7"), "HTTP 200, then connection reset"],
		"pull 8": [progress("pull 8"), "waiting for its body"],
	});
});

scopedHttpApp.it("drops every matching pull while a repeated scoped fault stays installed", [], function* ({ asks, scriptFault }) {
	yield* scriptFault("pull", { kind: "drop" }, { params: { number: "7" }, repeat: true });

	yield* outcomes({
		"first pull 7": [asks(PULL_7), "connection reset"],
		"pull 8": [asks(PULL_8), 'HTTP 200 {"owner":"team","repo":"platform","number":"8"}'],
		"second pull 7": [asks(PULL_7), "connection reset"],
		"third pull 7": [asks(PULL_7), "connection reset"],
	});
});

scopedHttpApp.it("answers matching pulls normally once a repeated scoped fault is lifted", [], function* ({ asks, scriptFault }) {
	const outage = yield* scriptFault("pull", { kind: "drop" }, { params: { number: "7" }, repeat: true });
	expect(yield* asks(PULL_7)).toBe("connection reset");

	yield* outage.lift;

	expect(yield* asks(PULL_7)).toBe('HTTP 200 {"owner":"team","repo":"platform","number":"7"}');
});

scopedHttpApp.it("tells the story when a scoped fault is lifted", [], function* ({ scriptFault, story }) {
	const outage = yield* scriptFault("pull", { kind: "drop" }, { params: { number: "7" }, repeat: true });

	yield* outage.lift;

	expect(story.lines.at(-1)).toBe('fake HTTP pull matching {"number":"7"} fault drop lifted');
});

scopedHttpApp.it("keeps answering with a repeated status reply and its headers", [], function* ({ answer, asks, header, scriptFault, sends }) {
	yield* scriptFault(
		"pull",
		{ kind: "status", reply: { headers: { "retry-after": "3" }, status: HttpStatus.fromLiteral("TooManyRequests") } },
		{ repeat: true },
	);
	expect(yield* asks(PULL_7)).toBe("HTTP 429");

	yield* sends("again", PULL_7);

	yield* outcomes({
		answer: [answer("again"), "HTTP 429"],
		"retry-after": [header("again", "retry-after"), "3"],
	});
});

scopedHttpApp.it("holds every pull matching the decoded scope while other pulls answer", [], function* ({ answer, asks, hold, requests, sends }) {
	const paused = yield* hold("pull", { params: { number: "7", owner: "a/b" } });
	yield* sends("first", "/repos/a%2Fb/platform/pulls/7");
	yield* paused.waiting;
	yield* sends("second", "/repos/a%2Fb/platform/pulls/7");
	yield* asks("/repos/a%2Fb/platform/pulls/8");
	yield* asks("/repos/other/platform/pulls/7");
	expect(yield* requests()).toEqual([
		"GET /repos/a%2Fb/platform/pulls/7 pending",
		"GET /repos/a%2Fb/platform/pulls/7 pending",
		"GET /repos/a%2Fb/platform/pulls/8 200",
		"GET /repos/other/platform/pulls/7 200",
	]);

	yield* paused.release;

	yield* outcomes({
		first: [answer("first"), 'HTTP 200 {"owner":"a/b","repo":"platform","number":"7"}'],
		second: [answer("second"), 'HTTP 200 {"owner":"a/b","repo":"platform","number":"7"}'],
	});
});

scopedHttpApp.it("holds only the first matching pull when the hold is once", [], function* ({ asks, hold, progress, sends }) {
	const paused = yield* hold("pull", { once: true, params: { number: "7" } });
	yield* sends("first", PULL_7);
	yield* paused.waiting;

	yield* outcomes({
		"the second pull 7": [asks(PULL_7), 'HTTP 200 {"owner":"team","repo":"platform","number":"7"}'],
		"while the first": [progress("first"), "waiting for an answer"],
	});
});

scopedHttpApp.it("releases only the scoped hold its arrival selects", [], function* ({ answer, asks, hold, progress, releaseOnArrival, sends }) {
	const target = yield* hold("pull", { once: true, params: { number: "7" } });
	const other = yield* hold("pull", { params: { number: "8" } });
	yield* releaseOnArrival("pull", "installation", { params: { number: "7" } });
	yield* sends("pull 7", PULL_7);
	yield* target.waiting;
	yield* sends("pull 8", PULL_8);
	yield* other.waiting;

	yield* asks("/installations/4");

	yield* outcomes({
		"pull 7": [answer("pull 7"), 'HTTP 200 {"owner":"team","repo":"platform","number":"7"}'],
		"pull 8": [progress("pull 8"), "waiting for an answer"],
	});
});
