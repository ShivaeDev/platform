import { Effect, Layer, Logger, ManagedRuntime, References } from "effect";
import { HttpBody, HttpClient, HttpClientError } from "effect/http";
import { expect, it } from "vitest";
import { otlpHttpClient } from "#otlpHttpClient.ts";
import { otlpTracing } from "#otlpTracing.ts";
import { otlpConfig } from "#test/otlpHost.ts";
import { otlpReceiver } from "#test/otlpReceiver.ts";

it.each(["headers", "body"])("fails an HTTP request with stalled %s in the typed error channel", async (stalled) => {
	const receiver = stalled === "headers" ? await otlpReceiver(() => undefined) : await otlpReceiver(200, null);
	const runtime = ManagedRuntime.make(otlpHttpClient(80));
	try {
		const error = await runtime.runPromise(
			HttpClient.post(`${receiver.url}/v1/traces`, { body: HttpBody.jsonUnsafe({ resourceSpans: [] }) }).pipe(Effect.flip, Effect.timeout(1000)),
		);
		expect(HttpClientError.isHttpClientError(error)).toBe(true);
		expect(error.reason).toMatchObject({ _tag: "TransportError", description: "OTLP export request timed out" });
		expect(receiver.requests).toHaveLength(1);
	} finally {
		await runtime.dispose();
		await receiver.close();
	}
});

it.each([
	{ env: {}, timeout: 10_000 },
	{ env: { "OTEL_EXPORTER_OTLP_TIMEOUT": "80" }, timeout: 80 },
	{ env: { "OTEL_EXPORTER_OTLP_TIMEOUT": "240" }, timeout: 240 },
	{ env: { "OTEL_EXPORTER_OTLP_TIMEOUT": "5000", "OTEL_EXPORTER_OTLP_TRACES_TIMEOUT": "80" }, timeout: 80 },
	{ env: { "OTEL_EXPORTER_OTLP_TIMEOUT": "80", "OTEL_EXPORTER_OTLP_TRACES_TIMEOUT": "240" }, timeout: 240 },
])(
	"times out stalled exports using $env and sends a later batch",
	async ({ env, timeout }) => {
		const receiver = await otlpReceiver((attempt) => (attempt === 1 ? undefined : 200));
		const failures: Record<string, unknown>[] = [];
		const logger = Logger.make(({ fiber, logLevel }) => {
			if (logLevel === "Warn") {
				failures.push(fiber.getRef(References.CurrentLogAnnotations));
			}
		});
		const runtime = ManagedRuntime.make(
			otlpTracing.pipe(
				Layer.provide(
					otlpConfig({
						...env,
						"OTEL_BSP_MAX_EXPORT_BATCH_SIZE": "1",
						"OTEL_BSP_SCHEDULE_DELAY": "60000",
						"OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url,
					}),
				),
				Layer.provideMerge(Logger.layer([logger])),
			),
		);
		try {
			await runtime.runPromise(Effect.void);
			const started = performance.now();
			await runtime.runPromise(Effect.void.pipe(Effect.withSpan("stalled-export")));
			await expect.poll(() => failures.length, { interval: 10, timeout: timeout + 500 }).toBe(1);
			expect(performance.now() - started).toBeGreaterThanOrEqual(timeout - 20);
			expect(performance.now() - started).toBeLessThan(timeout + 500);
			expect(failures[0]).toMatchObject({ "otlp.failure": "TransportError" });
			await runtime.runPromise(Effect.void.pipe(Effect.withSpan("later-export")));
			await expect.poll(() => receiver.requests.some(({ body }) => body.includes("later-export")), { timeout: 500 }).toBe(true);
			const closing = performance.now();
			await runtime.dispose();
			expect(performance.now() - closing).toBeLessThan(timeout + 500);
		} finally {
			await runtime.dispose();
			await receiver.close();
		}
	},
	15_000,
);

it("exports on the configured batch schedule", async () => {
	const receiver = await otlpReceiver();
	const runtime = ManagedRuntime.make(
		otlpTracing.pipe(
			Layer.provide(
				otlpConfig({
					"OTEL_BSP_MAX_EXPORT_BATCH_SIZE": "100",
					"OTEL_BSP_SCHEDULE_DELAY": "40",
					"OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url,
				}),
			),
		),
	);
	try {
		await runtime.runPromise(Effect.void.pipe(Effect.withSpan("scheduled-export")));
		await expect.poll(() => receiver.requests.length, { timeout: 500 }).toBe(1);
		expect(receiver.requests[0]?.body).toContain("scheduled-export");
	} finally {
		await runtime.dispose();
		await receiver.close();
	}
});

it("bounds shutdown with the batch export timeout", async () => {
	const receiver = await otlpReceiver(() => undefined);
	const runtime = ManagedRuntime.make(
		otlpTracing.pipe(
			Layer.provide(
				otlpConfig({
					"OTEL_BSP_EXPORT_TIMEOUT": "80",
					"OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url,
				}),
			),
		),
	);
	try {
		await runtime.runPromise(Effect.void.pipe(Effect.withSpan("shutdown-export")));
		const closing = performance.now();
		await runtime.dispose();
		expect(performance.now() - closing).toBeGreaterThanOrEqual(60);
		expect(performance.now() - closing).toBeLessThan(580);
		expect(receiver.requests).toHaveLength(1);
	} finally {
		await runtime.dispose();
		await receiver.close();
	}
});
