import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
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
		"OTEL_RESOURCE_ATTRIBUTES": "deployment.environment=local,service.name=resource-name",
		"OTEL_SERVICE_NAME": "host-test",
	});
	try {
		expect(await pingHost(runtime)).toBe("pong");
		await runtime.dispose();
		expect(receiver.requests).toHaveLength(1);
		expect(receiver.requests[0]).toMatchObject({ path: key.endsWith("TRACES_ENDPOINT") ? "/custom" : "/base/v1/traces", token: "collector secret" });
		const body = receiver.requests[0]?.body;
		expect(body).toContain('"key":"service.name","value":{"stringValue":"host-test"}');
		expect(body).toContain('"key":"deployment.environment","value":{"stringValue":"local"}');
		expect(body).toContain('"name":"POST"');
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
	const runtime = otlpHost({ ...env, "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url });
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

it("redacts sensitive attributes, resource values and failure details before export", async () => {
	const receiver = await otlpReceiver();
	const routes = HttpRouter.add(
		"GET",
		"/failed",
		Effect.gen(function* () {
			yield* Effect.annotateCurrentSpan({
				authorization: "hidden-authorization",
				cookie: "hidden-cookie",
				"db.user": "hidden-database-user",
				detail: ["Bearer hidden-array-token"],
			});
			const span = yield* Effect.currentSpan.pipe(Effect.orDie);
			span.event("password=hidden-event-password", 0n, { cookie: "hidden-event-cookie" });
			span.addLinks([{ attributes: { authorization: "hidden-link-authorization" }, span }]);
			return yield* Effect.die(new Error("postgres://hidden-database-user:hidden-database-password@localhost/db token=hidden-token"));
		}),
	);
	const runtime = otlpHost(
		{
			"OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url,
			"OTEL_RESOURCE_ATTRIBUTES": "service.name=resource-name,api.token=hidden-resource-token",
		},
		routes,
	);
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		expect(
			(
				await fetch(`${HttpServer.formatAddress(server.address)}/failed`, {
					headers: { authorization: "Bearer hidden-header-token", cookie: "session=hidden-header-cookie" },
				})
			).status,
		).toBe(500);
		await runtime.dispose();
		expect(receiver.requests).toHaveLength(1);
		const body = receiver.requests[0]?.body;
		expect(body).toContain('"stringValue":"resource-name"');
		expect(body).toContain("<redacted>");
		expect(body).not.toContain("hidden-");
	} finally {
		await runtime.dispose();
		await receiver.close();
	}
});
