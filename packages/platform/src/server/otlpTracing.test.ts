import { OtlpExporter } from "effect/observability";
import { expect } from "vitest";
import { environment, host } from "#test/app-host/story.ts";
import { collector, flushable } from "#test/app-host/telemetry.ts";

for (const endpoint of ["base", "traces"] as const) {
	host.it(
		`exports host spans when the ${endpoint} endpoint is configured`,
		[
			collector({
				endpoint,
				env: {
					"OTEL_EXPORTER_OTLP_HEADERS": "x-collector-token=collector%20secret",
					"OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
					"OTEL_RESOURCE_ATTRIBUTES": "deployment.environment=local,service.name=resource-name,service.version=resource-version",
					"OTEL_SERVICE_NAME": "host-test",
					"OTEL_SERVICE_VERSION": "1.2.3",
				},
			}),
		],
		function* ({ ping, close, exports }) {
			expect(yield* ping()).toBe("pong");
			yield* close();
			expect(exports()).toHaveLength(1);
			expect(exports()[0]).toMatchObject({ path: endpoint === "traces" ? "/custom" : "/base/v1/traces", token: "collector secret" });
			const body = exports()[0]?.body;
			expect(body).toContain('"key":"service.name","value":{"stringValue":"host-test"}');
			expect(body).toContain('"key":"deployment.environment","value":{"stringValue":"local"}');
			expect(body).toContain('"name":"POST /rpc"');
			expect(body).toContain('"key":"service.version","value":{"stringValue":"1.2.3"}');
			expect(body).not.toContain("resource-version");
			expect(body).not.toContain("collector secret");
		},
	);
}
for (const { env, name } of [
	{ env: { "OTEL_RESOURCE_ATTRIBUTES": "service.name=resource%20name" }, name: "resource name" },
	{ env: {}, name: "unknown_service" },
]) {
	host.it(
		`uses the service name fallback ${name}`,
		[collector({ env: { ...env, "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } })],
		function* ({ ping, close, exports }) {
			expect(yield* ping()).toBe("pong");
			yield* close();
			expect(exports()[0]?.body).toContain(`"key":"service.name","value":{"stringValue":"${name}"}`);
		},
	);
}
for (const env of [{}, { "OTEL_EXPORTER_OTLP_HEADERS": "authorization=secret", "OTEL_SERVICE_NAME": "metadata-only" }]) {
	host.it(`builds no exporter without an endpoint (${JSON.stringify(env)})`, [environment(env), flushable()], function* ({ ping, hasService }) {
		expect(yield* ping()).toBe("pong");
		expect(yield* hasService(OtlpExporter.Flusher)).toBe(false);
	});
}
for (const status of [undefined, 500]) {
	host.it(
		`collector failure (${status}) preserves requests and shutdown`,
		[collector({ ...(status === undefined ? { offline: true } : { status }), env: { "OTEL_SERVICE_NAME": "unavailable-test" } })],
		function* ({ ping, close }) {
			expect(yield* ping()).toBe("pong");
			yield* close();
		},
		10_000,
	);
}
