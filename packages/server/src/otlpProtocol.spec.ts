import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { environment, host, startupFails } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

for (const { contentType, env } of [
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
	host.it(
		`${JSON.stringify(env)} exports the host's spans as decodable ${contentType}`,
		[collector({ env })],
		function* ({ close, exportContentTypes, exportedSpanNames, ping }) {
			yield* ping();

			yield* close();

			yield* outcomes({
				"content types": [exportContentTypes(), [contentType]],
				"decoded spans": [exportedSpanNames(), expect.arrayContaining(["POST /rpc"])],
			});
		},
	);
}

for (const env of [
	{ "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc" },
	{ "OTEL_EXPORTER_OTLP_TRACES_PROTOCOL": "grpc" },
	{ "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json", "OTEL_EXPORTER_OTLP_TRACES_PROTOCOL": "grpc" },
]) {
	host.it(
		`${JSON.stringify(env)} fails startup with a config error naming grpc`,
		[startupFails, environment({ ...env, "OTEL_EXPORTER_OTLP_ENDPOINT": "http://127.0.0.1:1" })],
		function* ({ startup, startupFailureMessage }) {
			yield* outcomes({
				"message": [startupFailureMessage(), expect.stringContaining("grpc")],
				"startup": [startup(), "failed with config error"],
			});
		},
	);
}
