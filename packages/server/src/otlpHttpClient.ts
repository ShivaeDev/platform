import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientError, type HttpClientRequest, type HttpClientResponse } from "effect/http";
import { redactText } from "@shivaedev/errors/sensitive.ts";
import { filterStatus } from "@shivaedev/http/filterStatus.ts";
import { boundedOtlpResponse } from "#adapters/boundedOtlpResponse.ts";
import { RedactionPolicy } from "#RedactionPolicy.ts";

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
			function recordStatus(response: HttpClientResponse.HttpClientResponse) {
				const diagnostic = response.text.pipe(
					Effect.orElseSucceed(() => "Unable to read collector response"),
					Effect.map((body) => ({ "otlp.response": redactText(body, sensitive), "otlp.status": response.status })),
				);
				const checked = filterStatus(HttpClient.makeWith(() => Effect.succeed(response), Effect.succeed)).execute(response.request);
				return Effect.matchEffect(checked, {
					onFailure: () => warnOnce(diagnostic),
					onSuccess: () =>
						Effect.sync(() => {
							warned = false;
						}),
				});
			}
			return client.pipe(
				HttpClient.transformResponse(Effect.flatMap(boundedOtlpResponse)),
				HttpClient.transform((requestEffect, request) =>
					requestEffect.pipe(
						Effect.timeoutOrElse({
							duration: timeout,
							orElse: () => Effect.fail(timeoutError(request)),
						}),
					),
				),
				HttpClient.tap(recordStatus),
				HttpClient.tapError((error) => warnOnce(Effect.succeed({ "otlp.failure": error.reason._tag }))),
			);
		}),
	).pipe(Layer.provide(FetchHttpClient.layer));
}
