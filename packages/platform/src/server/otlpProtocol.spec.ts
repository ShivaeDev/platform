import { Cause, Config, Exit, Option } from "effect";
import { HttpServer } from "effect/http";
import { expect, it } from "vitest";
import { otlpHost, pingHost } from "#test/otlpHost.ts";
import { otlpReceiver } from "#test/otlpReceiver.ts";

it.each<{ env: Record<string, string>; contentType: string }>([
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
])("exports $contentType with $env", async ({ env, contentType }) => {
	const receiver = await otlpReceiver();
	const runtime = otlpHost({ ...env, "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url });
	try {
		expect(await pingHost(runtime)).toBe("pong");
		await runtime.dispose();
		expect(receiver.requests).toHaveLength(1);
		expect(receiver.requests[0]?.contentType).toBe(contentType);
		if (contentType === "application/json") {
			expect(JSON.parse(receiver.requests[0]?.body ?? "")).toHaveProperty("resourceSpans");
		} else {
			expect(receiver.requests[0]?.bytes[0]).toBe(0x0a);
			expect(receiver.requests[0]?.body).toContain("POST /rpc");
			expect(() => JSON.parse(receiver.requests[0]?.body ?? "")).toThrow();
		}
	} finally {
		await runtime.dispose();
		await receiver.close();
	}
});

it.each([
	{ "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc" },
	{ "OTEL_EXPORTER_OTLP_TRACES_PROTOCOL": "grpc" },
	{ "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json", "OTEL_EXPORTER_OTLP_TRACES_PROTOCOL": "grpc" },
])("fails host boot with a ConfigError naming the unsupported protocol (%o)", async (env) => {
	const runtime = otlpHost({ ...env, "OTEL_EXPORTER_OTLP_ENDPOINT": "http://127.0.0.1:1" });
	try {
		const exit = await runtime.runPromiseExit(HttpServer.HttpServer);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(Option.getOrUndefined(Cause.findErrorOption(exit.cause))).toBeInstanceOf(Config.ConfigError);
			expect(Cause.pretty(exit.cause)).toContain("grpc");
		}
	} finally {
		await runtime.dispose();
	}
});
