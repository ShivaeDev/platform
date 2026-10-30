import { Effect, Fiber } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { scopedHttpApp } from "#test/scopedHttpApp.ts";

scopedHttpApp.it(
	"checks both guards before a hold or scripted fault and accepts the token elsewhere",
	[],
	function* ({ hold, scriptFault, request }) {
		const paused = yield* hold("installation");
		yield* scriptFault("installation", { kind: "drop" });
		const rejected = yield* request("/installations/4", { token: "wrong" });
		expect(yield* rejected.headers).toMatchObject({ status: HttpStatus.fromLiteral("Unauthorized") });
		const serviceRejected = yield* request("/installations/4", { serviceKey: "wrong" });
		expect(yield* serviceRejected.headers).toMatchObject({ status: HttpStatus.fromLiteral("Unauthorized") });
		const elsewhere = yield* request("/repos/team/platform/pulls/7", { token: "wrong" });
		expect(yield* elsewhere.headers).toMatchObject({ status: HttpStatus.fromLiteral("OK") });
		const accepted = yield* request("/installations/4");
		yield* paused.waiting;
		yield* paused.release;
		expect(yield* accepted.headers).toMatchObject({ code: "ECONNRESET", kind: "error" });
		const next = yield* request("/installations/4");
		expect(yield* next.finished).toEqual({ bytes: Buffer.from('{"installation":"4"}'), kind: "complete" });
	},
);

scopedHttpApp.it("does not consume a one-shot reply for a route's rejected token", [], function* ({ scriptFault, request }) {
	yield* scriptFault("installation", { kind: "status", reply: { status: HttpStatus.fromLiteral("ServiceUnavailable") } });
	const rejected = yield* request("/installations/4", { token: "wrong" });
	expect(yield* rejected.headers).toMatchObject({ status: HttpStatus.fromLiteral("Unauthorized") });
	const accepted = yield* request("/installations/4");
	expect(yield* accepted.headers).toMatchObject({ status: HttpStatus.fromLiteral("ServiceUnavailable") });
	const next = yield* request("/installations/4");
	expect(yield* next.headers).toMatchObject({ status: HttpStatus.fromLiteral("OK") });
});

scopedHttpApp.it("does not release an arrival script for a route's rejected token", [], function* ({ hold, releaseOnArrival, request }) {
	const paused = yield* hold("pull");
	yield* releaseOnArrival("pull", "installation");
	const pull = yield* request("/repos/team/platform/pulls/7");
	yield* paused.waiting;
	const pending = yield* Effect.forkChild(pull.finished);
	const rejected = yield* request("/installations/4", { token: "wrong" });
	expect(yield* rejected.headers).toMatchObject({ status: HttpStatus.fromLiteral("Unauthorized") });
	expect(pending.pollUnsafe()).toBeUndefined();
	const accepted = yield* request("/installations/4");
	expect(yield* accepted.headers).toMatchObject({ status: HttpStatus.fromLiteral("OK") });
	expect(yield* Fiber.join(pending)).toMatchObject({ kind: "complete" });
});
