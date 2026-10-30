import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { httpFaultApp } from "#test/httpFaultApp.ts";

const READY = 'HTTP 200 {"ready":true}';

httpFaultApp.it(
	"keeps a held request waiting when its release route arrives without authorization",
	[],
	function* ({ asks, hold, progress, releaseOnArrival, sends }) {
		const paused = yield* hold("data");
		yield* releaseOnArrival("data", "trigger");
		yield* sends("client");
		yield* paused.waiting;

		yield* outcomes({
			"the unauthorized release": [asks("/trigger", { headers: { authorization: "rejected" } }), "HTTP 401"],
			"while the client": [progress("client"), "waiting for an answer"],
		});
	},
);

httpFaultApp.it("releases a held request when its release route arrives", [], function* ({ answer, asks, hold, releaseOnArrival, sends }) {
	const paused = yield* hold("data");
	yield* releaseOnArrival("data", "trigger");
	yield* sends("client");
	yield* paused.waiting;

	yield* asks("/trigger");

	expect(yield* answer("client")).toBe(READY);
});

httpFaultApp.it("answers a waiting request with a status fault's reply and headers", [], function* ({ answer, fault, header, hold, sends }) {
	const paused = yield* hold("data");
	yield* sends("client");
	yield* paused.waiting;

	yield* fault("data", {
		kind: "status",
		reply: { body: { error: "late failure" }, headers: { "retry-after": "2" }, status: HttpStatus.fromLiteral("ServiceUnavailable") },
	});

	yield* outcomes({
		answer: [answer("client"), 'HTTP 503 {"error":"late failure"}'],
		"retry-after": [header("client", "retry-after"), "2"],
	});
});

httpFaultApp.it("drops a waiting request's connection before any response headers", [], function* ({ answer, fault, hold, sends }) {
	const paused = yield* hold("data");
	yield* sends("client");
	yield* paused.waiting;

	yield* fault("data", { kind: "drop" });

	expect(yield* answer("client")).toBe("connection reset");
});

httpFaultApp.it(
	"resets a reply after the client has received its first body chunk",
	[],
	function* ({ answer, fault, nextChunk, sends, sendsNextChunk, streamsChunks }) {
		yield* streamsChunks(["partial body", "unreachable tail"]);
		yield* sends("client");
		yield* sendsNextChunk();
		expect(yield* nextChunk("client")).toBe("partial body");

		yield* fault("data", { kind: "reset" });

		expect(yield* answer("client")).toBe("HTTP 200, then connection reset");
	},
);

httpFaultApp.it("resets stalled and held connections when its scope closes", [], function* ({ answer, closesService, hold, sends, stall, status }) {
	const stalled = yield* stall("data");
	const held = yield* hold("trigger");
	yield* sends("stalled client", "/data");
	yield* sends("held client", "/trigger");
	yield* stalled.waiting;
	yield* held.waiting;
	expect(yield* status("stalled client")).toBe("HTTP 200");

	yield* closesService();

	yield* outcomes({
		"held client": [answer("held client"), "connection reset"],
		"stalled client": [answer("stalled client"), "HTTP 200, then connection reset"],
	});
});
