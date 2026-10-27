import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { httpFaultApp } from "#test/httpFaultApp.ts";

httpFaultApp.it("records normal answers, guard refusals and unmatched requests", [], function* ({ request, requestRejected, requests }) {
	const normal = yield* request();
	expect(yield* normal.finished).toMatchObject({ kind: "complete" });
	expect(yield* requestRejected()).toMatchObject({ status: HttpStatus.fromLiteral("Unauthorized") });
	const missing = yield* request("/missing");
	expect(yield* missing.finished).toMatchObject({ kind: "complete" });
	expect(requests()).toEqual(["GET /data 200", "GET /trigger 401", "GET /missing 404"]);
});

for (const kind of ["drop", "reset"] as const) {
	httpFaultApp.it(`records an immediate ${kind} as unanswered`, [], function* ({ hold, stall, request, fault, requests }) {
		const paused = yield* kind === "drop" ? hold("data") : stall("data");
		const client = yield* request();
		yield* paused.waiting;
		expect(requests()).toEqual(["GET /data pending"]);
		if (kind === "reset") {
			expect(yield* client.headers).toMatchObject({ status: HttpStatus.fromLiteral("OK") });
		}
		yield* fault("data", { kind });
		expect(yield* client.finished).toMatchObject({ code: "ECONNRESET", kind: "error" });
		expect(requests()).toEqual(["GET /data unanswered"]);
	});
}

for (const gate of ["hold", "stall"] as const) {
	httpFaultApp.it(`records a client that abandons a ${gate} as unanswered`, [], function* ({ hold, stall, request, waitForDisconnect, requests }) {
		const paused = yield* { hold, stall }[gate]("data");
		const client = yield* request();
		yield* paused.waiting;
		expect(requests()).toEqual(["GET /data pending"]);
		if (gate === "stall") {
			expect(yield* client.headers).toMatchObject({ status: HttpStatus.fromLiteral("OK") });
		}
		yield* client.abort;
		yield* waitForDisconnect();
		expect(requests()).toEqual(["GET /data unanswered"]);
	});
}

httpFaultApp.it("keeps every unscoped request held until release", [], function* ({ hold, request, requests }) {
	const paused = yield* hold("data");
	const first = yield* request();
	yield* paused.waiting;
	const second = yield* request();
	const barrier = yield* request("/trigger");
	yield* barrier.finished;
	expect(requests()).toEqual(["GET /data pending", "GET /data pending", "GET /trigger 200"]);
	yield* paused.release;
	expect(yield* first.finished).toMatchObject({ kind: "complete" });
	expect(yield* second.finished).toMatchObject({ kind: "complete" });
	expect(requests()).toEqual(["GET /data 200", "GET /data 200", "GET /trigger 200"]);
});

httpFaultApp.it("holds only the first unscoped request", [], function* ({ hold, request, requests }) {
	const paused = yield* hold("data", { once: true });
	const first = yield* request();
	yield* paused.waiting;
	const second = yield* request();
	expect(yield* second.finished).toMatchObject({ kind: "complete" });
	expect(requests()).toEqual(["GET /data pending", "GET /data 200"]);
	yield* paused.release;
	expect(yield* first.finished).toMatchObject({ kind: "complete" });
});

for (const kind of ["drop", "reset"] as const) {
	httpFaultApp.it(`records a scripted ${kind} before the route reply as unanswered`, [], function* ({ scriptFault, request, requests }) {
		yield* scriptFault("data", { kind });
		const client = yield* request();
		expect(yield* client.headers).toMatchObject(kind === "drop" ? { code: "ECONNRESET", kind: "error" } : { status: HttpStatus.fromLiteral("OK") });
		expect(yield* client.finished).toMatchObject({ code: "ECONNRESET", kind: "error" });
		expect(requests()).toEqual(["GET /data unanswered"]);
	});
}
