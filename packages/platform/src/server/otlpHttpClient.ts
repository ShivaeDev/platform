import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientError, type HttpClientRequest } from "effect/http";
import { RedactionPolicy } from "#server/RedactionPolicy.ts";
import { redactOtlpText } from "#server/safeOtlpSerialization.ts";

function timeoutError(request: HttpClientRequest.HttpClientRequest) {
	return new HttpClientError.HttpClientError({
		reason: new HttpClientError.TransportError({ description: "OTLP export request timed out", request }),
	});
}

export function otlpHttpClient(timeout = 10_000) {
	return Layer.effect(
		HttpClient.HttpClient,
		Effect.gen(function* () {
			const client = yield* HttpClient.HttpClient;
			const sensitive = yield* RedactionPolicy;
			let warned = false;
			function warnOnce(diagnostic: Effect.Effect<Record<string, unknown>>) {
				return Effect.suspend(() => {
					if (warned) {
						return Effect.void;
					}
					warned = true;
					return Effect.flatMap(diagnostic, (annotations) => Effect.logWarning("OTLP trace export failed").pipe(Effect.annotateLogs(annotations)));
				});
			}
			return client.pipe(
				HttpClient.tap((response) => response.arrayBuffer),
				HttpClient.transform((requestEffect, request) =>
					requestEffect.pipe(
						Effect.timeoutOrElse({
							duration: timeout,
							orElse: () => Effect.fail(timeoutError(request)),
						}),
					),
				),
				HttpClient.tap((response) => {
					if (response.status >= 200 && response.status < 300) {
						warned = false;
						return Effect.void;
					}
					return warnOnce(
						response.text.pipe(
							Effect.orElseSucceed(() => "Unable to read collector response"),
							Effect.map((body) => ({ "otlp.response": redactOtlpText(body, "", sensitive), "otlp.status": response.status })),
						),
					);
				}),
				HttpClient.tapError((error) => warnOnce(Effect.succeed({ "otlp.failure": error.reason._tag }))),
			);
		}),
	).pipe(Layer.provide(FetchHttpClient.layer));
}
