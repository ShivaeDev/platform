import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { httpFaultApp } from "#test/httpFaultApp.ts";

httpFaultApp.it("releases a held call when the named authorized route arrives", [], function* ({ hold, releaseOnArrival, request, requestRejected }) {
	const paused = yield* hold("data");
	yield* releaseOnArrival("data", "trigger");
	const client = yield* request();
	yield* paused.waiting;
	const body = yield* Effect.forkChild(client.finished);
	expect((yield* requestRejected()).status).toBe(401);
	expect(body.pollUnsafe()).toBeUndefined();
	const trigger = yield* request("/trigger");
	expect(yield* trigger.finished).toEqual({ bytes: Buffer.from('{"triggered":true}'), kind: "complete" });
	expect(yield* Fiber.join(body)).toEqual({ bytes: Buffer.from('{"ready":true}'), kind: "complete" });
});

httpFaultApp.it("replaces an already arrived request with a scripted status reply", [], function* ({ hold, request, fault }) {
	const paused = yield* hold("data");
	const client = yield* request();
	yield* paused.waiting;
	yield* fault("data", { kind: "status", reply: { body: { error: "late failure" }, headers: { "retry-after": "2" }, status: 503 } });
	expect(yield* client.headers).toMatchObject({ headers: { "retry-after": "2" }, status: 503 });
	expect(yield* client.finished).toEqual({ bytes: Buffer.from('{"error":"late failure"}'), kind: "complete" });
	yield* paused.release;
	const next = yield* request();
	expect(yield* next.headers).toMatchObject({ status: 200 });
});

httpFaultApp.it("drops an arrived connection before any response headers", [], function* ({ hold, request, fault }) {
	const paused = yield* hold("data");
	const client = yield* request();
	yield* paused.waiting;
	yield* fault("data", { kind: "drop" });
	expect(yield* client.headers).toMatchObject({ code: "ECONNRESET", kind: "error" });
	expect(yield* client.finished).toMatchObject({ code: "ECONNRESET", kind: "error" });
});

httpFaultApp.it("resets a reply after the client has received its first body chunk", [], function* ({ streamChunks, sendChunk, request, fault }) {
	yield* streamChunks(["partial body", "unreachable tail"]);
	const client = yield* request();
	yield* sendChunk();
	expect(yield* client.nextChunk).toEqual(Buffer.from("partial body"));
	expect(yield* client.headers).toMatchObject({ status: 200 });
	yield* fault("data", { kind: "reset" });
	expect(yield* client.finished).toMatchObject({ code: "ECONNRESET", kind: "error" });
});

httpFaultApp.it("closes stalled and held connections with its scope", [], function* ({ stall, hold, request, close }) {
	const stalled = yield* stall("data");
	const held = yield* hold("trigger");
	const body = yield* request();
	const headers = yield* request("/trigger");
	yield* stalled.waiting;
	yield* held.waiting;
	expect(yield* body.headers).toMatchObject({ status: 200 });
	yield* close();
	expect(yield* body.finished).toMatchObject({ code: "ECONNRESET", kind: "error" });
	expect(yield* headers.headers).toMatchObject({ code: "ECONNRESET", kind: "error" });
});
