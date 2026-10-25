import { Cause, Config, Option } from "effect";
import { expect } from "vitest";
import { environment, host, startupFails } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

for (const { env, contentType } of [
	{ contentType: "application/x-protobuf", env: {} },
	{ contentType: "application/x-protobuf", env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/protobuf" } },
	{ contentType: "application/json", env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } },
	{ contentType: "application/x-protobuf", env: { "OTEL_EXPORTER_OTLP_TRACES_PROTOCOL": "http/protobuf" } },
	{ contentType: "application/json", env: { "OTEL_EXPORTER_OTLP_TRACES_PROTOCOL": "http/json" } },
	{
		contentType: "application/x-protobuf",
		env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json", "OTEL_EXPORTER_OTLP_TRACES_PROTOCOL": "http/protobuf" },
	},
	{ contentType: "application/json", env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc", "OTEL_EXPORTER_OTLP_TRACES_PROTOCOL": "http/json" } },
]) {
	host.it(`exports ${contentType} with ${JSON.stringify(env)}`, [collector({ env })], function* ({ ping, close, exports, exportedSpans }) {
		expect(yield* ping()).toBe("pong");
		yield* close();
		expect(exports()).toMatchObject([{ path: "/v1/traces" }]);
		expect(exports()[0]?.contentType).toBe(contentType);
		if (contentType === "application/json") {
			expect(JSON.parse(exports()[0]?.body ?? "")).toHaveProperty("resourceSpans");
		} else {
			expect(exportedSpans().map(({ name }) => name)).toContain("POST /rpc");
			expect(exports()[0]?.body).toContain("POST /rpc");
			expect(() => JSON.parse(exports()[0]?.body ?? "")).toThrow();
		}
	});
}
for (const env of [
	{ "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc" },
	{ "OTEL_EXPORTER_OTLP_TRACES_PROTOCOL": "grpc" },
	{ "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json", "OTEL_EXPORTER_OTLP_TRACES_PROTOCOL": "grpc" },
]) {
	host.it(
		`fails host boot with a ConfigError naming the unsupported protocol (${JSON.stringify(env)})`,
		[startupFails, environment({ ...env, "OTEL_EXPORTER_OTLP_ENDPOINT": "http://127.0.0.1:1" })],
		({ bootFailure }) => {
			const cause = bootFailure();
			expect(Option.getOrUndefined(Cause.findErrorOption(cause))).toBeInstanceOf(Config.ConfigError);
			expect(Cause.pretty(cause)).toContain("grpc");
		},
	);
}
