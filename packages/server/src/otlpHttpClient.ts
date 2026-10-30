import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientError, type HttpClientRequest } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { redactText } from "@shivaedev/errors/sensitive.ts";
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
					if (response.status >= HttpStatus.fromLiteral("OK") && response.status < HttpStatus.fromLiteral("MultipleChoices")) {
						warned = false;
						return Effect.void;
					}
					return warnOnce(
						response.text.pipe(
							Effect.orElseSucceed(() => "Unable to read collector response"),
							Effect.map((body) => ({ "otlp.response": redactText(body, sensitive), "otlp.status": response.status })),
						),
					);
				}),
				HttpClient.tapError((error) => warnOnce(Effect.succeed({ "otlp.failure": error.reason._tag }))),
			);
		}),
	).pipe(Layer.provide(FetchHttpClient.layer));
}
