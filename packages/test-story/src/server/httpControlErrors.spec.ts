import { Effect } from "effect";
import { expect } from "vitest";
import { defectMessage } from "#test/defectMessage.ts";
import { httpFaultApp } from "#test/httpFaultApp.ts";

httpFaultApp.it(
	"checks both route names before installing any control",
	[],
	function* ({ stall, replyOnce, releaseOnArrival, fault, hold, request }) {
		for (const action of [
			stall("missing"),
			replyOnce("missing", { body: new Uint8Array([1]) }),
			releaseOnArrival("missing", "trigger"),
			releaseOnArrival("data", "missing"),
			fault("missing", { kind: "drop" }),
		]) {
			expect(defectMessage(yield* Effect.exit(action))).toContain('Unknown fake HTTP route "missing"');
		}
		const paused = yield* hold("data");
		const client = yield* request();
		yield* paused.waiting;
		yield* paused.release;
		expect(yield* client.finished).toEqual({ bytes: Buffer.from('{"ready":true}'), kind: "complete" });
	},
);

httpFaultApp.it("explains missing holds and duplicate body stalls", [], function* ({ releaseOnArrival, stall }) {
	expect(defectMessage(yield* Effect.exit(releaseOnArrival("data", "trigger")))).toContain('route "data" has no hold');
	const paused = yield* stall("data");
	expect(defectMessage(yield* Effect.exit(stall("data")))).toContain('route "data" already has a stall');
	yield* paused.release;
	yield* stall("data");
});

httpFaultApp.it("rejects late faults without a matching request instead of poisoning the next call", [], function* ({ fault, request }) {
	for (const kind of ["status", "drop", "reset"] as const) {
		const action = fault("data", kind === "status" ? { kind, reply: { status: 503 } } : { kind });
		expect(defectMessage(yield* Effect.exit(action))).toContain(`no request ready for a ${kind} fault`);
	}
	const client = yield* request();
	expect(yield* client.headers).toMatchObject({ status: 200 });
	expect(yield* client.finished).toEqual({ bytes: Buffer.from('{"ready":true}'), kind: "complete" });
});

httpFaultApp.it("requires headers for a reset and refuses status or drop faults after headers", [], function* ({ hold, stall, request, fault }) {
	const held = yield* hold("data");
	const stalled = yield* stall("data");
	const client = yield* request();
	yield* held.waiting;
	expect(defectMessage(yield* Effect.exit(fault("data", { kind: "reset" })))).toContain("no request ready for a reset fault");
	yield* held.release;
	yield* stalled.waiting;
	expect(yield* client.headers).toMatchObject({ status: 200 });
	expect(defectMessage(yield* Effect.exit(fault("data", { kind: "status", reply: { status: 503 } })))).toContain(
		"no request ready for a status fault",
	);
	expect(defectMessage(yield* Effect.exit(fault("data", { kind: "drop" })))).toContain("no request ready for a drop fault");
	yield* stalled.release;
	expect(yield* client.finished).toMatchObject({ kind: "complete" });
});

httpFaultApp.it(
	"tells the story about reply, stall, arrival release and fault controls",
	[],
	function* ({ replyOnce, stall, hold, releaseOnArrival, request, fault, story }) {
		yield* replyOnce("data", { body: new Uint8Array([0, 255]) });
		const stalled = yield* stall("data");
		const client = yield* request();
		yield* stalled.waiting;
		yield* stalled.release;
		expect(yield* client.finished).toMatchObject({ kind: "complete" });
		const held = yield* hold("data");
		yield* releaseOnArrival("data", "trigger");
		const waiting = yield* request();
		yield* held.waiting;
		yield* fault("data", { kind: "drop" });
		expect(yield* waiting.headers).toMatchObject({ kind: "error" });
		const trigger = yield* request("/trigger");
		yield* trigger.finished;
		expect(story.lines).toEqual([
			"fake HTTP data will answer once with 200",
			"fake HTTP data body will stall",
			"fake HTTP received GET /data",
			"fake HTTP answered GET /data with 200",
			"fake HTTP data body stalled",
			"fake HTTP data body released",
			"fake HTTP data held",
			"fake HTTP data will release when trigger arrives",
			"fake HTTP received GET /data",
			"fake HTTP data has a waiting request",
			"fake HTTP data fault drop",
			"fake HTTP received GET /trigger",
			"fake HTTP data released",
			"fake HTTP answered GET /trigger with 200",
		]);
	},
);
