import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { httpClient, oversizedBody, routeBody } from "#test/http-client/story.ts";
import { ResponseBodyTooLarge } from "./errors.ts";

httpClient.it("refuses an oversized Content-Length without waiting to read the body", [oversizedBody(true)], function* ({ bytes }) {
	expect(yield* Effect.flip(bytes(10))).toEqual(new ResponseBodyTooLarge({ limit: 10 }));
});

httpClient.it("interrupts a chunked body as soon as its bytes exceed the limit", [oversizedBody(false)], function* ({ bytes }) {
	expect(yield* Effect.flip(bytes(10))).toEqual(new ResponseBodyTooLarge({ limit: 10 }));
});

httpClient.it("returns body bytes at the limit", [routeBody({ chunks: ["paper", " & ink"] })], function* ({ bytes }) {
	expect(yield* bytes(11)).toEqual(new TextEncoder().encode("paper & ink"));
});

httpClient.it("decodes bounded UTF-8 text", [routeBody({ chunks: [new Uint8Array([0xc3]), new Uint8Array([0xa9])] })], function* ({ text }) {
	expect(yield* text(2)).toBe("é");
});

httpClient.it("decodes bounded JSON through the caller's Schema", [routeBody({ body: { name: "paper" } })], function* ({ json }) {
	expect(yield* json(100, Schema.Struct({ name: Schema.String }))).toEqual({ name: "paper" });
});

httpClient.it("rejects JSON that does not match the caller's Schema", [routeBody({ body: { name: 12 } })], function* ({ json }) {
	expect(yield* Effect.flip(json(100, Schema.Struct({ name: Schema.String })))).toBeInstanceOf(Schema.SchemaError);
});

httpClient.it("the JSON reader enforces the byte bound before decoding", [routeBody({ body: { name: "paper" } })], function* ({ json }) {
	expect(yield* Effect.flip(json(10, Schema.Struct({ name: Schema.String })))).toEqual(new ResponseBodyTooLarge({ limit: 10 }));
});
