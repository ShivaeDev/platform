import { Effect } from "effect";
import { otlpReceiver } from "@shivaedev/test-story/server/otlpReceiver.ts";

export function workerTracing<E, R>(
	tell: (line: string) => void,
	startWorker: (env: Record<string, string>) => Effect.Effect<Effect.Effect<void>, E, R>,
) {
	return {
		collector: Effect.fn("AppStory.collector")(function* () {
			tell("start the application's trace collector");
			const receiver = yield* otlpReceiver();
			return {
				...receiver,
				startWorker: () => startWorker({ "OTEL_BSP_SCHEDULE_DELAY": "100", "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url }),
			};
		}),
	};
}
