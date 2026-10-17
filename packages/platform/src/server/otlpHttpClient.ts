import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { redactOtlpText } from "#safeOtlpSerialization.ts";

export const otlpHttpClient = Layer.effect(
	HttpClient.HttpClient,
	Effect.gen(function* () {
		const client = yield* HttpClient.HttpClient;
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
			HttpClient.tap((response) => {
				if (response.status >= 200 && response.status < 300) {
					warned = false;
					return Effect.void;
				}
				return warnOnce(
					response.text.pipe(
						Effect.orElseSucceed(() => "Unable to read collector response"),
						Effect.map((body) => ({ "otlp.response": redactOtlpText(body), "otlp.status": response.status })),
					),
				);
			}),
			HttpClient.tapError((error) => warnOnce(Effect.succeed({ "otlp.failure": error.reason._tag }))),
		);
	}),
).pipe(Layer.provide(FetchHttpClient.layer));
