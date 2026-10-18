import { Effect, Exit, Scope } from "effect";
import { otlpReceiver } from "@shivaedev/test-story/otlpReceiver.ts";

export function workerTracing<E, R>(
	tell: (line: string) => void,
	startWorker: (env: Record<string, string>) => Effect.Effect<Effect.Effect<void>, E, R>,
) {
	return {
		collector: Effect.fn("AppStory.collector")(function* (status?: number | "down") {
			tell(`start a collector that ${status === "down" ? "is down" : `returns HTTP ${status ?? 200}`}`);
			const scope = yield* Scope.make();
			yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
			const receiver = yield* otlpReceiver({ status: typeof status === "number" ? status : 200 }).pipe(Scope.provide(scope));
			if (status === "down") {
				yield* Scope.close(scope, Exit.void);
			}
			return {
				...receiver,
				startWorker: (protocol?: string) => startWorker(tracingEnvironment(receiver.url, protocol)),
			};
		}),
	};
}

function tracingEnvironment(url: string, protocol?: string) {
	return {
		...(protocol === undefined ? { "OTEL_EXPORTER_OTLP_ENDPOINT": url } : { "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT": `${url}/v1/traces` }),
		"OTEL_BSP_SCHEDULE_DELAY": "100",
		...(protocol === undefined
			? {}
			: {
					"OTEL_EXPORTER_OTLP_HEADERS": "x-collector-token=worker%20collector%20secret",
					"OTEL_EXPORTER_OTLP_PROTOCOL": protocol,
					"OTEL_RESOURCE_ATTRIBUTES": "deployment.environment=worker-test",
					"OTEL_SERVICE_NAME": "worker-test",
				}),
	};
}
