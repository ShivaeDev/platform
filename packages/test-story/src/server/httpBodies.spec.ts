import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { httpFaultApp } from "#test/httpFaultApp.ts";

const STALLED_REPLY = { body: { released: true }, headers: { "x-story": "stalled" }, status: HttpStatus.fromLiteral("Accepted") };

httpFaultApp.it("sends a stalled reply's status and headers before its body", [], function* ({ header, progress, replyOnce, sends, stall, status }) {
	yield* replyOnce("data", STALLED_REPLY);
	const paused = yield* stall("data");

	yield* sends("client");

	yield* paused.waiting;
	yield* outcomes({
		"the status": [status("client"), "HTTP 202"],
		"the x-story header": [header("client", "x-story"), "stalled"],
		"while the body": [progress("client"), "waiting for its body"],
	});
});

httpFaultApp.it("sends a stalled reply's body once the stall is released", [], function* ({ answer, replyOnce, sends, stall, status }) {
	yield* replyOnce("data", STALLED_REPLY);
	const paused = yield* stall("data");
	yield* sends("client");
	yield* paused.waiting;
	expect(yield* status("client")).toBe("HTTP 202");

	yield* paused.release;

	expect(yield* answer("client")).toBe('HTTP 202 {"released":true}');
});

httpFaultApp.it("keeps every later matching body stalled until the same release", [], function* ({ answer, asks, progress, sends, stall, status }) {
	const paused = yield* stall("data");
	yield* sends("first");
	yield* paused.waiting;
	yield* sends("second");
	expect(yield* status("second")).toBe("HTTP 200");
	yield* asks("/trigger");
	expect(yield* progress("second")).toBe("waiting for its body");

	yield* paused.release;

	yield* outcomes({
		first: [answer("first"), 'HTTP 200 {"ready":true}'],
		second: [answer("second"), 'HTTP 200 {"ready":true}'],
	});
});

httpFaultApp.it("serves the next request after a client hangs up on a stalled body", [], function* ({ abandons, asks, sends, stall }) {
	const paused = yield* stall("data");
	yield* sends("client");
	yield* paused.waiting;
	yield* abandons("client");

	yield* paused.release;

	expect(yield* asks("/data")).toBe('HTTP 200 {"ready":true}');
});

httpFaultApp.it("sends binary reply bytes as they are with the content type the reply names", [], function* ({ answer, header, replyOnce, sends }) {
	yield* replyOnce("data", { body: Uint8Array.from([0, 255, 128, 13, 10]), headers: { "content-type": "image/png" } });

	yield* sends("client");

	yield* outcomes({
		answer: [answer("client"), "HTTP 200 <00 ff 80 0d 0a>"],
		"content type": [header("client", "content-type"), "image/png"],
	});
});

httpFaultApp.it("answers normally once a one-shot reply is spent", [], function* ({ asks, replyOnce }) {
	yield* replyOnce("data", { body: Uint8Array.from([0, 255]) });

	yield* outcomes({
		"the first request": [asks("/data"), "HTTP 200 <00 ff>"],
		"the next request": [asks("/data"), 'HTTP 200 {"ready":true}'],
	});
});

for (const [shape, reply, answer] of [
	["a Buffer body", { body: Buffer.from([0, 255]) }, "HTTP 200 <00 ff>"],
	["synchronous chunks", { chunks: ["head", Buffer.from([0, 255]), "tail"] }, "HTTP 200 head<00 ff>tail"],
] as const) {
	httpFaultApp.it(`writes ${shape} without JSON encoding`, [], function* ({ asks, replyOnce }) {
		yield* replyOnce("data", { ...reply, headers: { "content-type": "application/octet-stream" } });

		expect(yield* asks("/data")).toBe(answer);
	});
}

httpFaultApp.it(
	"sends a chunk while the next one is not yet available",
	[],
	function* ({ nextChunk, progress, sends, sendsNextChunk, streamsChunks }) {
		yield* streamsChunks(["first", Uint8Array.from([0, 255]), "last"]);
		yield* sends("client");

		yield* sendsNextChunk();

		yield* outcomes({
			"chunk received": [nextChunk("client"), "first"],
			progress: [progress("client"), "waiting for its body"],
		});
	},
);

httpFaultApp.it(
	"streams chunks with a chunked transfer encoding and ends the body after the last",
	[],
	function* ({ answer, header, sends, sendsNextChunk, streamsChunks }) {
		yield* streamsChunks(["first", Uint8Array.from([0, 255]), "last"]);
		yield* sends("client");

		yield* sendsNextChunk();
		yield* sendsNextChunk();
		yield* sendsNextChunk();

		yield* outcomes({
			answer: [answer("client"), "HTTP 200 first<00 ff>last"],
			"content type": [header("client", "content-type"), "application/octet-stream"],
			"transfer encoding": [header("client", "transfer-encoding"), "chunked"],
		});
	},
);
