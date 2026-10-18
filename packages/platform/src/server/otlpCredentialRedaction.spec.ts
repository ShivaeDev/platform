import { Effect, Layer, ManagedRuntime } from "effect";
import { expect, it } from "vitest";
import { otlpTracing } from "#otlpTracing.ts";
import { otlpConfig } from "#test/otlpHost.ts";
import { otlpReceiver } from "#test/otlpReceiver.ts";

it.each(["http/json", "http/protobuf"])("redacts bare signatures and PEM private keys before %s export", async (protocol) => {
	const receiver = await otlpReceiver();
	const runtime = ManagedRuntime.make(
		otlpTracing.pipe(
			Layer.provide(
				otlpConfig({
					"OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url,
					"OTEL_EXPORTER_OTLP_PROTOCOL": protocol,
				}),
			),
		),
	);
	const values = {
		error: "error: request failed sig=hidden-error-signature&x=1",
		host: "host/path sig=hidden-bare-signature",
		query: "host/path?sig=hidden-query-signature&x=1",
		shortError: "error: sig=hidden-short-error-signature&x=1",
		sig: "hidden-signature-attribute",
		...Object.fromEntries(
			["PRIVATE KEY", "RSA PRIVATE KEY", "EC PRIVATE KEY", "OPENSSH PRIVATE KEY", "ENCRYPTED PRIVATE KEY"].map((kind, index) => [
				`pem${index}`,
				`before -----BEGIN ${kind}-----\nhidden-key-${index}\nsecond-line\n-----END ${kind}----- after`,
			]),
		),
	};
	try {
		await runtime.runPromise(
			Effect.gen(function* () {
				yield* Effect.annotateCurrentSpan(values);
				const span = yield* Effect.currentSpan.pipe(Effect.orDie);
				span.event("credentials", 0n, values);
			}).pipe(Effect.withSpan("credential-redaction")),
		);
		await runtime.dispose();
		expect(receiver.requests).toHaveLength(1);
		const body = receiver.requests[0]?.body;
		expect(body).not.toContain("hidden-");
		expect(body).not.toContain("second-line");
		expect(body).not.toContain("PRIVATE KEY");
		expect(body).toContain("host/path sig=<redacted>");
		expect(body).toContain("error: request failed sig=<redacted>&x=1");
		expect(body).toContain("error: sig=<redacted>&x=1");
		expect(body).toContain("host/path?sig=<redacted>&x=<redacted>");
		expect(body).toContain("before <redacted> after");
	} finally {
		await runtime.dispose();
		await receiver.close();
	}
});
