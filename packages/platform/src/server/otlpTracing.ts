import { Config, Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { OtlpTracer } from "effect/observability";
import { safeOtlpSerialization } from "#safeOtlpSerialization.ts";

export const otlpTracing: Layer.Layer<never, Config.ConfigError> = Layer.unwrap(
	Effect.gen(function* () {
		const endpoint = yield* Config.URL("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT").pipe(
			Config.orElse(() =>
				Config.URL("OTEL_EXPORTER_OTLP_ENDPOINT").pipe(
					Config.map((url) => {
						url.pathname = `${url.pathname.replace(/\/$/u, "")}/v1/traces`;
						return url;
					}),
				),
			),
			Config.withDefault(undefined),
		);
		if (endpoint === undefined) {
			return Layer.empty;
		}
		const attributes: Record<string, string> = yield* Config.Record(
			Schema.StringFromUriComponent,
			Schema.StringFromUriComponent,
			"OTEL_RESOURCE_ATTRIBUTES",
		).pipe(Config.withDefault({}));
		const serviceName = yield* Config.String("OTEL_SERVICE_NAME").pipe(Config.withDefault(attributes["service.name"] ?? "unknown_service"));
		const headers = yield* Config.Record(Schema.String, Schema.StringFromUriComponent, "OTEL_EXPORTER_OTLP_HEADERS").pipe(Config.withDefault({}));
		return OtlpTracer.layer({ headers, resource: { attributes, serviceName }, url: endpoint.toString() }).pipe(
			Layer.provide(safeOtlpSerialization),
			Layer.provide(FetchHttpClient.layer),
		);
	}),
);
