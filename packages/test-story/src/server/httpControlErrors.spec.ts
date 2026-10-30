import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { attempt } from "#test/attempt.ts";
import { httpFaultApp, notReadyForFault } from "#test/httpFaultApp.ts";

const UNKNOWN_ROUTE = 'died: Unknown fake HTTP route "missing".\nhelp: Use a name from fakeHttpService\'s routes when scripting a reply or hold.';

const UNAVAILABLE = { kind: "status", reply: { status: HttpStatus.fromLiteral("ServiceUnavailable") } } as const;

for (const control of ["stall", "scriptFault", "releaseOnArrival", "releaseOnArrival with an unknown arrival", "fault"] as const) {
	httpFaultApp.it(`refuses ${control} for a route the service does not have`, [], function* ({ fault, releaseOnArrival, scriptFault, stall }) {
		const scripted = {
			fault: fault("missing", { kind: "drop" }),
			releaseOnArrival: releaseOnArrival("missing", "trigger"),
			"releaseOnArrival with an unknown arrival": releaseOnArrival("data", "missing"),
			scriptFault: scriptFault("missing", { kind: "status", reply: { body: new Uint8Array([1]) } }),
			stall: stall("missing"),
		}[control];

		expect(yield* attempt(scripted)).toBe(UNKNOWN_ROUTE);
	});
}

httpFaultApp.it("refuses an arrival release for a route without a hold", [], function* ({ releaseOnArrival }) {
	expect(yield* attempt(releaseOnArrival("data", "trigger"))).toBe(
		'died: Fake HTTP route "data" has no hold.\nhelp: Hold the route before scripting its release on arrival.',
	);
});

httpFaultApp.it("refuses a second stall on a route that already has one", [], function* ({ stall }) {
	yield* stall("data");

	expect(yield* attempt(stall("data"))).toBe(
		'died: Fake HTTP route "data" already has a stall.\nhelp: Release its current stall before scripting another.',
	);
});

httpFaultApp.it("accepts a new stall once the route's stall is released", [], function* ({ stall }) {
	const paused = yield* stall("data");

	yield* paused.release;

	expect(yield* attempt(stall("data"))).toBe("succeeded");
});

for (const [kind, scripted] of [
	["status", UNAVAILABLE],
	["drop", { kind: "drop" }],
	["reset", { kind: "reset" }],
] as const) {
	httpFaultApp.it(`refuses a ${kind} fault while no request waits and answers the next request normally`, [], function* ({ asks, fault }) {
		yield* outcomes({
			"the fault": [attempt(fault("data", scripted)), notReadyForFault(kind)],
			"the next request": [asks("/data"), 'HTTP 200 {"ready":true}'],
		});
	});
}

httpFaultApp.it("refuses a reset fault while the waiting request has no headers yet", [], function* ({ fault, hold, sends }) {
	const paused = yield* hold("data");
	yield* sends("client");
	yield* paused.waiting;

	expect(yield* attempt(fault("data", { kind: "reset" }))).toBe(notReadyForFault("reset"));
});

for (const [kind, scripted] of [
	["status", UNAVAILABLE],
	["drop", { kind: "drop" }],
] as const) {
	httpFaultApp.it(`refuses a ${kind} fault once the waiting request has its headers`, [], function* ({ fault, sends, stall, status }) {
		const paused = yield* stall("data");
		yield* sends("client");
		yield* paused.waiting;

		yield* outcomes({
			"the client's status": [status("client"), "HTTP 200"],
			"the fault": [attempt(fault("data", scripted)), notReadyForFault(kind)],
		});
	});
}

httpFaultApp.it("tells the story about a one-shot reply and a stall", [], function* ({ scriptFault, sends, stall, story }) {
	yield* scriptFault("data", { kind: "status", reply: { body: new Uint8Array([0, 255]) } });
	const paused = yield* stall("data");
	yield* sends("client");
	yield* paused.waiting;

	yield* paused.release;

	expect(story.lines).toEqual([
		"fake HTTP data will fault status before reply once",
		"fake HTTP data body will stall",
		"client sends GET /data",
		"fake HTTP received GET /data",
		"fake HTTP answered GET /data with 200",
		"fake HTTP data body stalled",
		"fake HTTP data body released",
	]);
});

httpFaultApp.it("tells the story about an arrival release and a fault", [], function* ({ asks, fault, hold, releaseOnArrival, sends, story }) {
	const paused = yield* hold("data");
	yield* releaseOnArrival("data", "trigger");
	yield* sends("client");
	yield* paused.waiting;

	yield* fault("data", { kind: "drop" });
	yield* asks("/trigger");

	expect(story.lines).toEqual([
		"fake HTTP data held",
		"fake HTTP data will release when trigger arrives",
		"client sends GET /data",
		"fake HTTP received GET /data",
		"fake HTTP data has a waiting request",
		"fake HTTP data fault drop",
		"the client asks for GET /trigger",
		"fake HTTP received GET /trigger",
		"fake HTTP data released",
		"fake HTTP answered GET /trigger with 200",
	]);
});
