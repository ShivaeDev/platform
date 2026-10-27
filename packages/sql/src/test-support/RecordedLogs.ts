import { Cause, Context, Effect, Layer, Logger } from "effect";
import { MinimumLogLevel } from "effect/References";

export class RecordedLogs extends Context.Service<
	RecordedLogs,
	Array<{ readonly annotations: Record<string, unknown>; readonly cause: string; readonly level: string; readonly message: unknown }>
>()("sql/test/RecordedLogs") {
	static readonly layer = Layer.unwrap(
		Effect.sync(() => {
			const entries: RecordedLogs["Service"] = [];
			const logger = Logger.make((options) => {
				entries.push({
					annotations: Logger.formatStructured.log(options).annotations,
					cause: Cause.pretty(options.cause),
					level: options.logLevel,
					message: options.message,
				});
			});
			return Layer.mergeAll(Layer.succeed(RecordedLogs, entries), Logger.layer([logger]), Layer.succeed(MinimumLogLevel, "Debug"));
		}),
	);
}
