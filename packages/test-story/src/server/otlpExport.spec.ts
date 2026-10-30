import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { lifecycle, otlpApp } from "#test/otlpApp.ts";

const MALFORMED = Buffer.from([0x0a, 0xff]);
const EMPTY = Buffer.from("{}");

for (const [format, contentType] of [
	["JSON", "application/json"],
	["protobuf", "application/x-protobuf"],
] as const) {
	const app = otlpApp(format === "protobuf");

	app.it(`reads every span a ${format} exporter sends`, [], function* ({ exportedSpanNames, exportsItsWork }) {
		yield* exportsItsWork();

		expect(yield* exportedSpanNames()).toEqual(["child", "failed", "parent"]);
	});

	app.it(`keeps the ids the application traced on a ${format} span`, [], function* ({ exportedSpanIds, exportsItsWork, tracedIds }) {
		yield* exportsItsWork();

		expect(yield* exportedSpanIds("child")).toEqual(yield* tracedIds());
	});

	app.it(`decodes a ${format} span's attributes, events, links, kind, resource and status`, [], function* ({ exportedSpan, exportsItsWork }) {
		yield* exportsItsWork();

		expect(yield* exportedSpan("child")).toMatchObject({
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
	});

	app.it(`decodes a failed ${format} span's error status and message`, [], function* ({ exportedSpan, exportsItsWork }) {
		yield* exportsItsWork();

		expect(yield* exportedSpan("failed")).toMatchObject({ status: { code: 2, message: "failed work" } });
	});

	app.it(`keeps the path and headers of each ${format} export request`, [], function* ({ exportRequests, exportsItsWork }) {
		yield* exportsItsWork();

		expect(yield* exportRequests()).toEqual(Array.from({ length: 3 }, () => `/v1/traces as ${contentType} with token "collector secret"`));
	});

	app.it(`keeps the raw bytes of each ${format} export`, [], function* ({ exportsCarrying, exportsItsWork }) {
		yield* exportsItsWork();

		yield* outcomes({
			"exports carrying the header secret": [exportsCarrying("collector secret"), 0],
			"exports carrying the planted span attribute": [exportsCarrying("raw-export-secret"), 1],
		});
	});
}

lifecycle.it("stops listening once its scope closes", [], function* ({ closesReceiver, sends }) {
	expect(yield* sends("/v1/traces", "application/json", EMPTY)).toBe("HTTP 200");

	yield* closesReceiver();

	expect(yield* sends("/v1/traces", "application/json", EMPTY)).toBe("connection refused");
});

for (const [what, path, contentType, body, answer] of [
	["malformed JSON", "/v1/traces", "application/json", MALFORMED, "HTTP 400"],
	["malformed protobuf", "/v1/traces", "application/x-protobuf", MALFORMED, "HTTP 400"],
	["another path", "/wrong", "application/json", EMPTY, "HTTP 404"],
	["an unsupported content type", "/v1/traces", "text/plain", EMPTY, "HTTP 415"],
	["JSON with a charset", "/v1/traces", "application/json; charset=utf-8", EMPTY, "HTTP 200"],
] as const) {
	lifecycle.it(`answers an export of ${what} with ${answer}`, [], function* ({ sends }) {
		expect(yield* sends(path, contentType, body)).toBe(answer);
	});
}

lifecycle.it("records every request it receives, refused ones included, and keeps receiving", [], function* ({ received, sends }) {
	yield* sends("/v1/traces", "application/x-protobuf", MALFORMED);
	yield* sends("/wrong", "application/json", EMPTY);

	yield* sends("/v1/traces", "application/json", EMPTY);

	expect(yield* received()).toEqual([
		"/v1/traces as application/x-protobuf: <0a ff>",
		"/wrong as application/json: {}",
		"/v1/traces as application/json: {}",
	]);
});
