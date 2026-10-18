import { expect } from "vitest";
import { declarationOrder, flattenedEncoding, unionEncoding } from "#test/app-host/encodingGraph.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

for (const [key, value] of [
	["wireContact", "private contact"],
	["alternateContact", "alternate private contact"],
]) {
	host.it(`masks sensitive values in the ${key} union branch of an encoded RPC failure`, [unionEncoding], function* ({ postNdjson }) {
		const response = yield* postNdjson(
			`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: { value }, tag: "unionFailure" })}\n`,
			false,
		);
		expect(response.status).toBe(200);
		expect(response.body).toContain('"_tag":"Fail"');
		expect(response.body).toContain(`"${key}":"<redacted>"`);
		expect(response.body).not.toContain(value);
	});
}

for (const declaration of ["schema", "host"] as const) {
	host.it(
		`protects flattened descendants declared sensitive by the ${declaration}`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } }), flattenedEncoding(declaration)],
		function* ({ postNdjson, logs, close, exportedSpans }) {
			const value = "private nested contact";
			const response = yield* postNdjson(
				`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: { value }, tag: "flattened" })}\n`,
				false,
			);
			expect(response.status).toBe(200);
			expect(response.body).toContain('"_tag":"Fail"');
			expect(response.body).toContain('"wireContact":"<redacted>"');
			expect(response.body).toContain('"wireVisible":"<redacted>"');
			expect(response.body).not.toContain(value);
			const diagnostic = logs().find((entry) => Array.isArray(entry.message) && entry.message.includes("flattened diagnostic"));
			expect(diagnostic?.annotations).toMatchObject({ visible: "public detail", wireContact: "<redacted>", wireVisible: "<redacted>" });
			yield* close();
			expect(exportedSpans().find((span) => span.name === "flattened")?.attributes).toEqual(
				expect.arrayContaining([
					{ key: "wireContact", value: { stringValue: "<redacted>" } },
					{ key: "wireVisible", value: { stringValue: "<redacted>" } },
					{ key: "visible", value: { stringValue: "public detail" } },
				]),
			);
		},
	);
}

for (const order of ["first", "last"] as const) {
	host.it(
		`protects direct and chained encoded names when their sensitive declaration is ${order}`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } }), declarationOrder(order)],
		function* ({ postNdjson, logs, close, exportedSpans }) {
			const value = "private ordered contact";
			for (const [tag, key] of [
				["mapped", "wireContact"],
				["lastLink", "wireChainedContact"],
			]) {
				const response = yield* postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: tag, payload: { value }, tag })}\n`, false);
				expect(response.status).toBe(200);
				expect(response.body).toContain('"_tag":"Fail"');
				expect(response.body).toContain(`"${key}":"<redacted>"`);
				expect(response.body).toContain('"visible":"public detail"');
				expect(response.body).not.toContain(value);
			}
			const diagnostic = logs().find((entry) => Array.isArray(entry.message) && entry.message.includes("mapping diagnostic"));
			expect(diagnostic?.annotations).toMatchObject({
				contact: "<redacted>",
				intermediateContact: "<redacted>",
				visible: "public detail",
				wireChainedContact: "<redacted>",
				wireContact: "<redacted>",
			});
			yield* close();
			expect(exportedSpans().find((span) => span.name === "mapped")?.attributes).toEqual(
				expect.arrayContaining([
					{ key: "wireContact", value: { stringValue: "<redacted>" } },
					{ key: "wireChainedContact", value: { stringValue: "<redacted>" } },
					{ key: "visible", value: { stringValue: "public detail" } },
				]),
			);
		},
	);
}
