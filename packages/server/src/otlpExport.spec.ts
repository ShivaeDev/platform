import * as HttpStatus from "effect/http/HttpStatus";
import { OtlpExporter } from "effect/observability";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { environment, host } from "#test/app-host/story.ts";
import { collector, flushable } from "#test/app-host/telemetry.ts";

const described = {
	"OTEL_EXPORTER_OTLP_HEADERS": "x-collector-token=collector%20secret",
	"OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
	"OTEL_RESOURCE_ATTRIBUTES": "deployment.environment=local,service.name=resource-name,service.version=resource-version",
	"OTEL_SERVICE_NAME": "host-test",
	"OTEL_SERVICE_VERSION": "1.2.3",
};

for (const [endpoint, path] of [
	["base", "/base/v1/traces"],
	["traces", "/custom"],
] as const) {
	host.it(
		`the ${endpoint} endpoint receives the host's spans at ${path} with the decoded collector header`,
		[collector({ endpoint, env: described })],
		function* ({ close, exports, ping }) {
			yield* ping();

			yield* close();

			expect(yield* exports()).toMatchObject([{ path, token: "collector secret" }]);
		},
	);
}

host.it(
	"exported spans name the service and version from OTEL_SERVICE_* over OTEL_RESOURCE_ATTRIBUTES and keep other resource attributes",
	[collector({ env: described })],
	function* ({ close, exportedResource, ping }) {
		yield* ping();

		yield* close();

		expect(yield* exportedResource()).toMatchObject({ "deployment.environment": "local", "service.name": "host-test", "service.version": "1.2.3" });
	},
);

host.it(
	"exported spans carry the RPC server span but not the collector header value",
	[collector({ env: described })],
	function* ({ close, exportedSpanNames, exportsMentioning, ping }) {
		yield* ping();

		yield* close();

		yield* outcomes({
			"exports mentioning the header value": [exportsMentioning("collector secret"), 0],
			"span names": [exportedSpanNames(), expect.arrayContaining(["POST /rpc"])],
		});
	},
);

for (const [fallback, env, name] of [
	["the resource service.name", { "OTEL_RESOURCE_ATTRIBUTES": "service.name=resource%20name" }, "resource name"],
	["unknown_service", {}, "unknown_service"],
] as const) {
	host.it(
		`without OTEL_SERVICE_NAME, exported spans name the service ${fallback}`,
		[collector({ env: { ...env, "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } })],
		function* ({ close, exportedResource, ping }) {
			yield* ping();

			yield* close();

			expect(yield* exportedResource()).toMatchObject({ "service.name": name });
		},
	);
}

for (const [settings, env] of [
	["no OTLP settings", {}],
	["only headers and a service name", { "OTEL_EXPORTER_OTLP_HEADERS": "authorization=secret", "OTEL_SERVICE_NAME": "metadata-only" }],
] as const) {
	host.it(`with ${settings} but no endpoint the host builds no OTLP exporter`, [environment(env), flushable()], function* ({ provided }) {
		expect(yield* provided(OtlpExporter.Flusher)).toBe("missing");
	});
}

for (const [failure, options] of [
	["an offline collector", { offline: true }],
	["a collector answering 500", { status: HttpStatus.fromLiteral("InternalServerError") }],
] as const) {
	host.it(
		`${failure} leaves RPC answering and shutdown completing`,
		[collector({ ...options, env: { "OTEL_SERVICE_NAME": "unavailable-test" } })],
		function* ({ close, httpAnswer, ping }) {
			expect(yield* ping()).toBe("pong");

			yield* close();

			expect(yield* httpAnswer()).toBe("refuses connections");
		},
		10_000,
	);
}
