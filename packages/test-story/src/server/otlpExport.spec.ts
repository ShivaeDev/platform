import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { lifecycle, otlpApp } from "#test/otlpApp.ts";

for (const protobuf of [false, true]) {
	const app = otlpApp(protobuf);
	app.it("reads real exported spans and every raw export byte", [], function* ({ runWork, failWork, disposeRuntime, requests, spans }) {
		const ids = yield* runWork();
		yield* failWork();
		yield* disposeRuntime();
		expect(
			spans()
				.map(({ name }) => name)
				.sort(),
		).toEqual(["child", "failed", "parent"]);
		expect(spans().find(({ name }) => name === "child")).toMatchObject({
			...ids,
			attributes: expect.arrayContaining([
				{ key: "count", value: { intValue: "42" } },
				{ key: "negative", value: { intValue: "-12" } },
				{ key: "fractional", value: { doubleValue: 1.5 } },
				{ key: "flag", value: { boolValue: true } },
				{ key: "tags", value: { arrayValue: { values: [{ stringValue: "one" }, { stringValue: "two" }] } } },
			]),
			events: [{ attributes: [{ key: "detail", value: { stringValue: "event value" } }], name: "received", timeUnixNano: "123" }],
			kind: 3,
			links: [
				{
					attributes: [{ key: "detail", value: { stringValue: "link value" } }],
					spanId: "1234567890abcdef",
					traceId: "1234567890abcdef1234567890abcdef",
				},
			],
			resourceAttributes: expect.arrayContaining([{ key: "service.name", value: { stringValue: "story-exporter" } }]),
			status: { code: 1 },
		});
		expect(spans().find(({ name }) => name === "failed")?.status).toMatchObject({ code: 2, message: "failed work" });
		expect(requests()).toMatchObject([
			{
				headers: { "content-type": protobuf ? "application/x-protobuf" : "application/json", "x-collector-token": "collector secret" },
				path: "/v1/traces",
			},
			{
				headers: { "content-type": protobuf ? "application/x-protobuf" : "application/json", "x-collector-token": "collector secret" },
				path: "/v1/traces",
			},
			{
				headers: { "content-type": protobuf ? "application/x-protobuf" : "application/json", "x-collector-token": "collector secret" },
				path: "/v1/traces",
			},
		]);
		expect(requests().every(({ body }) => !body.includes(Buffer.from("collector secret")))).toBe(true);
		expect(requests()[0]?.headers).toMatchObject({
			"content-type": protobuf ? "application/x-protobuf" : "application/json",
			"x-collector-token": "collector secret",
		});
		expect(requests()[0]?.rawHeaders).toContain("collector secret");
		expect(requests().some(({ body }) => body.includes(Buffer.from("raw-export-secret")))).toBe(true);
	});
}

lifecycle.it("releases its listening port with the scope", [], function* ({ close, send, url }) {
	const address = url();
	const status = yield* send("/v1/traces", "application/json", Buffer.from("{}"));
	expect(status).toBe(HttpStatus.fromLiteral("OK"));
	yield* close();
	yield* Effect.promise(() => expect(fetch(`${address}/v1/traces`)).rejects.toThrow());
});

lifecycle.it("keeps malformed export bytes and continues receiving", [], function* ({ requests, send }) {
	const malformed = Buffer.from([0x0a, 0xff]);
	const empty = Buffer.from("{}");
	for (const contentType of ["application/json", "application/x-protobuf"]) {
		const status = yield* send("/v1/traces", contentType, malformed);
		expect(status).toBe(HttpStatus.fromLiteral("BadRequest"));
	}
	for (const [path, contentType, expectedStatus] of [
		["/wrong", "application/json", HttpStatus.fromLiteral("NotFound")],
		["/v1/traces", "text/plain", HttpStatus.fromLiteral("UnsupportedMediaType")],
		["/v1/traces", "application/json; charset=utf-8", HttpStatus.fromLiteral("OK")],
	] as const) {
		const status = yield* send(path, contentType, empty);
		expect(status).toBe(expectedStatus);
	}
	expect(requests()).toMatchObject([
		{ body: malformed, headers: { "content-type": "application/json" }, path: "/v1/traces" },
		{ body: malformed, headers: { "content-type": "application/x-protobuf" }, path: "/v1/traces" },
		{ body: empty, headers: { "content-type": "application/json" }, path: "/wrong" },
		{ body: empty, headers: { "content-type": "text/plain" }, path: "/v1/traces" },
		{ body: empty, headers: { "content-type": "application/json; charset=utf-8" }, path: "/v1/traces" },
	]);
});
