import { Context, Effect, Layer, Logger, ManagedRuntime, Option, References } from "effect";
import { HttpBody, HttpClient } from "effect/http";
import { OtlpExporter } from "effect/observability";
import { expect, it } from "vitest";
import { otlpHttpClient } from "#otlpHttpClient.ts";
import { otlpTracing } from "#otlpTracing.ts";
import { otlpConfig } from "#test/otlpHost.ts";
import { otlpReceiver } from "#test/otlpReceiver.ts";

it.each([400, 503, undefined])(
	"warns once on the first export failure (%s), with the redacted collector answer when present",
	async (status) => {
		const receiver = await otlpReceiver(status, "Unsupported content type; token=hidden-collector-token");
		if (status === undefined) {
			await receiver.close();
		}
		const logs: { level: string; attempt: number; annotations: Record<string, unknown>; message: unknown }[] = [];
		const logger = Logger.make((options) =>
			logs.push({
				annotations: options.fiber.getRef(References.CurrentLogAnnotations),
				attempt: receiver.requests.length,
				level: options.logLevel,
				message: options.message,
			}),
		);
		const runtime = ManagedRuntime.make(
			otlpTracing.pipe(
				Layer.provide(
					otlpConfig({ "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url, "OTEL_EXPORTER_OTLP_HEADERS": "authorization=hidden-exporter-secret" }),
				),
				Layer.provideMerge(Logger.layer([logger])),
			),
		);
		try {
			await runtime.runPromise(Effect.void.pipe(Effect.withSpan("export-me")));
			const context = await runtime.runPromise(Effect.context());
			const flusher = Option.getOrThrow(Context.getOption(context, OtlpExporter.Flusher));
			await runtime.runPromise(flusher.flush);
			await runtime.runPromise(Effect.void.pipe(Effect.withSpan("another-span")));
			await runtime.runPromise(flusher.flush);
			await runtime.dispose();
			const warnings = logs.filter(({ level }) => level === "Warn");
			expect(warnings).toHaveLength(1);
			expect(warnings[0]?.message).toEqual(["OTLP trace export failed"]);
			if (status === undefined) {
				expect(warnings[0]?.annotations).toMatchObject({ "otlp.failure": "TransportError" });
			} else {
				expect(warnings[0]?.attempt).toBe(1);
				expect(warnings[0]?.annotations).toMatchObject({ "otlp.response": "Unsupported content type; token=<redacted>", "otlp.status": status });
			}
			expect(JSON.stringify(logs)).not.toContain("hidden-");
		} finally {
			await runtime.dispose();
			if (status !== undefined) {
				await receiver.close();
			}
		}
	},
	10_000,
);

it("warns again after the collector recovers", async () => {
	const statuses = [400, 400, 200, 400];
	const receiver = await otlpReceiver((attempt) => statuses[attempt - 1] ?? 200);
	let warnings = 0;
	const logger = Logger.make(({ logLevel }) => {
		if (logLevel === "Warn") {
			warnings += 1;
		}
	});
	const runtime = ManagedRuntime.make(otlpHttpClient().pipe(Layer.provideMerge(Logger.layer([logger]))));
	try {
		const counts: number[] = [];
		for (const status of statuses) {
			const response = await runtime.runPromise(
				Effect.flatMap(HttpClient.HttpClient, (client) =>
					client.post(`${receiver.url}/v1/traces`, { body: HttpBody.jsonUnsafe({ resourceSpans: [] }) }),
				),
			);
			expect(response.status).toBe(status);
			counts.push(warnings);
		}
		expect(counts).toEqual([1, 1, 1, 2]);
	} finally {
		await runtime.dispose();
		await receiver.close();
	}
});
