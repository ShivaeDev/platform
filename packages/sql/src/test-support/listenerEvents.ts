import { Effect, Logger, Queue } from "effect";

export const listenerEvents = Effect.gen(function* () {
	const events = {
		closings: yield* Queue.unbounded<void>(),
		heartbeats: yield* Queue.unbounded<Effect.Effect<void>>(),
		listeners: yield* Queue.unbounded<void>(),
		losses: yield* Queue.unbounded<void>(),
		reconnects: yield* Queue.unbounded<void>(),
		recoveries: yield* Queue.unbounded<void>(),
		resyncs: yield* Queue.unbounded<void>(),
	};
	const loggers = yield* Logger.CurrentLoggers;
	const logger = Logger.make((options) => {
		switch (options.logLevel) {
			case "Warn":
				Queue.offerUnsafe(events.losses, undefined);
				break;
			case "Debug":
				Queue.offerUnsafe(events.reconnects, undefined);
				break;
			case "Info":
				Queue.offerUnsafe(events.recoveries, undefined);
				break;
		}
	});
	return { ...events, loggers: new Set([...loggers, logger]) };
});
