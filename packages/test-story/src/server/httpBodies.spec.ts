import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { httpFaultApp } from "#test/httpFaultApp.ts";

httpFaultApp.it("flushes status and headers while its body waits for release", [], function* ({ stall, replyOnce, request }) {
	yield* replyOnce("data", { body: { released: true }, headers: { "x-story": "stalled" }, status: 202 });
	const paused = yield* stall("data");
	const client = yield* request();
	yield* paused.waiting;
	expect(yield* client.headers).toMatchObject({ headers: { "x-story": "stalled" }, kind: "headers", status: 202 });
	const body = yield* Effect.forkChild(client.finished);
	const other = yield* request("/trigger");
	yield* other.finished;
	expect(body.pollUnsafe()).toBeUndefined();
	yield* paused.release;
	expect(yield* Fiber.join(body)).toEqual({ bytes: Buffer.from('{"released":true}'), kind: "complete" });
});

httpFaultApp.it("delivers binary reply bytes with the supplied content type exactly once", [], function* ({ replyOnce, request }) {
	const bytes = Uint8Array.from([0, 255, 128, 13, 10]);
	yield* replyOnce("data", { body: bytes, headers: { "content-type": "image/png" } });
	const client = yield* request();
	expect(yield* client.headers).toMatchObject({ headers: { "content-type": "image/png" }, status: 200 });
	expect(yield* client.finished).toEqual({ bytes: Buffer.from(bytes), kind: "complete" });
	const next = yield* request();
	expect(yield* next.finished).toEqual({ bytes: Buffer.from('{"ready":true}'), kind: "complete" });
});

httpFaultApp.it("sends each chunk before the next piece is available", [], function* ({ streamChunks, sendChunk, request }) {
	yield* streamChunks(["first", Uint8Array.from([0, 255]), "last"]);
	const client = yield* request();
	const body = yield* Effect.forkChild(client.finished);
	yield* sendChunk();
	expect(yield* client.nextChunk).toEqual(Buffer.from("first"));
	expect(yield* client.headers).toMatchObject({ headers: { "content-type": "application/octet-stream", "transfer-encoding": "chunked" } });
	expect(body.pollUnsafe()).toBeUndefined();
	yield* sendChunk();
	expect(yield* client.nextChunk).toEqual(Buffer.from([0, 255]));
	expect(body.pollUnsafe()).toBeUndefined();
	yield* sendChunk();
	expect(yield* Fiber.join(body)).toEqual({ bytes: Buffer.from([102, 105, 114, 115, 116, 0, 255, 108, 97, 115, 116]), kind: "complete" });
});

httpFaultApp.it("lets a client abandon a stalled body and serves a later request", [], function* ({ stall, request }) {
	const paused = yield* stall("data");
	const client = yield* request();
	yield* paused.waiting;
	expect(yield* client.headers).toMatchObject({ kind: "headers", status: 200 });
	yield* client.abort;
	expect(yield* client.finished).toMatchObject({ code: "ECONNRESET", kind: "error" });
	yield* paused.release;
	const next = yield* request();
	expect(yield* next.finished).toMatchObject({ kind: "complete" });
});

httpFaultApp.it("keeps later matching bodies stalled until the same release", [], function* ({ stall, request }) {
	const paused = yield* stall("data");
	const first = yield* request();
	yield* paused.waiting;
	const second = yield* request();
	expect(yield* first.headers).toMatchObject({ status: 200 });
	expect(yield* second.headers).toMatchObject({ status: 200 });
	const pending = yield* Effect.forkChild(second.finished);
	const trigger = yield* request("/trigger");
	yield* trigger.finished;
	expect(pending.pollUnsafe()).toBeUndefined();
	yield* paused.release;
	expect(yield* first.finished).toEqual({ bytes: Buffer.from('{"ready":true}'), kind: "complete" });
	expect(yield* Fiber.join(pending)).toEqual({ bytes: Buffer.from('{"ready":true}'), kind: "complete" });
});

httpFaultApp.it("writes Buffer bodies and synchronous chunks without JSON encoding", [], function* ({ replyOnce, request }) {
	yield* replyOnce("data", { body: Buffer.from([0, 255]), headers: { "content-type": "application/octet-stream" } });
	const binary = yield* request();
	expect(yield* binary.finished).toEqual({ bytes: Buffer.from([0, 255]), kind: "complete" });
	yield* replyOnce("data", { chunks: ["head", Buffer.from([0, 255]), "tail"], headers: { "content-type": "application/octet-stream" } });
	const chunked = yield* request();
	expect(yield* chunked.finished).toEqual({
		bytes: Buffer.concat([Buffer.from("head"), Buffer.from([0, 255]), Buffer.from("tail")]),
		kind: "complete",
	});
});
