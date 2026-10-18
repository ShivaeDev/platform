import { Cause, Context, Effect, Layer, Logger } from "effect";

export class RecordedLogs extends Context.Service<
	RecordedLogs,
	Array<{ readonly cause: string; readonly level: string; readonly message: unknown }>
>()("effect-sql/test/RecordedLogs") {
	static readonly layer = Layer.unwrap(
		Effect.sync(() => {
			const entries: RecordedLogs["Service"] = [];
			const logger = Logger.make((options) => {
				entries.push({ cause: Cause.pretty(options.cause), level: options.logLevel, message: options.message });
			});
			return Layer.merge(Layer.succeed(RecordedLogs, entries), Logger.layer([logger]));
		}),
	);
}
