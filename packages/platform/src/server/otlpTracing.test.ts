import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { OtlpExporter } from "effect/observability";
import { expect, it } from "vitest";
import { otlpTracing } from "#otlpTracing.ts";
import { otlpConfig, otlpHost, pingHost } from "#test/otlpHost.ts";
import { otlpReceiver } from "#test/otlpReceiver.ts";

it.each(["OTEL_EXPORTER_OTLP_ENDPOINT", "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"])("exports host spans when %s is configured", async (key) => {
	const receiver = await otlpReceiver();
	const runtime = otlpHost({
		...(key.endsWith("TRACES_ENDPOINT") ? { "OTEL_EXPORTER_OTLP_ENDPOINT": `${receiver.url}/ignored` } : {}),
		[key]: key.endsWith("TRACES_ENDPOINT") ? `${receiver.url}/custom` : `${receiver.url}/base/`,
		"OTEL_EXPORTER_OTLP_HEADERS": "x-collector-token=collector%20secret",
		"OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
		"OTEL_RESOURCE_ATTRIBUTES": "deployment.environment=local,service.name=resource-name,service.version=resource-version",
		"OTEL_SERVICE_NAME": "host-test",
		"OTEL_SERVICE_VERSION": "1.2.3",
	});
	try {
		expect(await pingHost(runtime)).toBe("pong");
		await runtime.dispose();
		expect(receiver.requests).toHaveLength(1);
		expect(receiver.requests[0]).toMatchObject({ path: key.endsWith("TRACES_ENDPOINT") ? "/custom" : "/base/v1/traces", token: "collector secret" });
		const body = receiver.requests[0]?.body;
		expect(body).toContain('"key":"service.name","value":{"stringValue":"host-test"}');
		expect(body).toContain('"key":"deployment.environment","value":{"stringValue":"local"}');
		expect(body).toContain('"name":"POST /rpc"');
		expect(body).toContain('"key":"service.version","value":{"stringValue":"1.2.3"}');
		expect(body).not.toContain("resource-version");
		expect(body).not.toContain("collector secret");
	} finally {
		await runtime.dispose();
		await receiver.close();
	}
});

it.each([
	{ env: { "OTEL_RESOURCE_ATTRIBUTES": "service.name=resource%20name" }, name: "resource name" },
	{ env: {}, name: "unknown_service" },
])("uses the service name fallback $name", async ({ env, name }) => {
	const receiver = await otlpReceiver();
	const runtime = otlpHost({ ...env, "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url, "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" });
	try {
		expect(await pingHost(runtime)).toBe("pong");
		await runtime.dispose();
		expect(receiver.requests[0]?.body).toContain(`"key":"service.name","value":{"stringValue":"${name}"}`);
	} finally {
		await runtime.dispose();
		await receiver.close();
	}
});

it.each<Record<string, string>>([{}, { "OTEL_EXPORTER_OTLP_HEADERS": "authorization=secret", "OTEL_SERVICE_NAME": "metadata-only" }])(
	"builds no exporter without an endpoint (%o)",
	async (env) => {
		const runtime = ManagedRuntime.make(otlpTracing.pipe(Layer.provide(otlpConfig(env))));
		try {
			const context = await runtime.runPromise(Effect.context());
			expect(Context.getOption(context, OtlpExporter.Flusher)._tag).toBe("None");
		} finally {
			await runtime.dispose();
		}
	},
);

it.each([undefined, 500])(
	"collector failure (%s) preserves requests and shutdown",
	async (status) => {
		const receiver = await otlpReceiver(status);
		if (status === undefined) {
			await receiver.close();
		}
		const runtime = otlpHost({ "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url, "OTEL_SERVICE_NAME": "unavailable-test" });
		try {
			expect(await pingHost(runtime)).toBe("pong");
			await expect(runtime.dispose()).resolves.toBeUndefined();
		} finally {
			await runtime.dispose();
			if (status !== undefined) {
				await receiver.close();
			}
		}
	},
	10_000,
);
