import { Config, Effect, Layer, Schema } from "effect";
import { OtlpSerialization, OtlpTracer } from "effect/observability";
import { otlpHttpClient } from "#server/otlpHttpClient.ts";
import { safeOtlpSerialization } from "#server/safeOtlpSerialization.ts";

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
		const configuredProtocol = yield* Config.String("OTEL_EXPORTER_OTLP_TRACES_PROTOCOL").pipe(
			Config.orElse(() => Config.String("OTEL_EXPORTER_OTLP_PROTOCOL")),
			Config.withDefault("http/protobuf"),
		);
		const protocol = yield* Schema.decodeUnknownEffect(Schema.Literals(["http/protobuf", "http/json"]), { reportInput: true })(
			configuredProtocol,
		).pipe(Effect.mapError((cause) => new Config.ConfigError(cause)));
		const attributes: Record<string, string> = yield* Config.Record(
			Schema.StringFromUriComponent,
			Schema.StringFromUriComponent,
			"OTEL_RESOURCE_ATTRIBUTES",
		).pipe(Config.withDefault({}));
		const serviceName = yield* Config.String("OTEL_SERVICE_NAME").pipe(Config.withDefault(attributes["service.name"] ?? "unknown_service"));
		const serviceVersion = yield* Config.String("OTEL_SERVICE_VERSION").pipe(Config.withDefault(undefined));
		const headers = yield* Config.Record(Schema.String, Schema.StringFromUriComponent, "OTEL_EXPORTER_OTLP_HEADERS").pipe(Config.withDefault({}));
		const requestTimeout = yield* Config.Int("OTEL_EXPORTER_OTLP_TRACES_TIMEOUT").pipe(
			Config.orElse(() => Config.Int("OTEL_EXPORTER_OTLP_TIMEOUT")),
			Config.withDefault(10_000),
		);
		const exportInterval = yield* Config.Int("OTEL_BSP_SCHEDULE_DELAY").pipe(Config.withDefault(5000));
		const maxBatchSize = yield* Config.Int("OTEL_BSP_MAX_EXPORT_BATCH_SIZE").pipe(Config.withDefault(1000));
		const exportTimeout = yield* Config.Int("OTEL_BSP_EXPORT_TIMEOUT").pipe(Config.withDefault(3000));
		return OtlpTracer.layer({
			exportInterval,
			headers,
			maxBatchSize,
			resource: { attributes, serviceName, serviceVersion },
			shutdownTimeout: Math.min(exportTimeout, requestTimeout),
			url: endpoint.toString(),
		}).pipe(
			Layer.provide(
				safeOtlpSerialization.pipe(Layer.provide(protocol === "http/protobuf" ? OtlpSerialization.layerProtobuf : OtlpSerialization.layerJson)),
			),
			Layer.provide(otlpHttpClient(requestTimeout)),
		);
	}),
);
