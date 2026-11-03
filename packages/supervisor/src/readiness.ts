import { Effect, Option, type PlatformError, Schema, Stream } from "effect";
export class ReadinessMissing extends Schema.TaggedError<ReadinessMissing>()("ReadinessMissing", {}) {}
export function jsonReadiness<TSchema extends Schema.Constraint>(schema: TSchema) {
	return (stdout: Stream.Stream<string, PlatformError.PlatformError>) =>
		stdout.pipe(
			Stream.runHead,
			Effect.flatMap((line) =>
				Effect.gen(function* () {
					if (Option.isNone(line)) {
						return yield* Effect.fail(new ReadinessMissing({}));
					}
					return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(line.value);
				}),
			),
		);
}
export const withoutReadiness = Effect.fnUntraced(function* (stdout: Stream.Stream<string, PlatformError.PlatformError>) {
	yield* Effect.forkScoped(Stream.runDrain(stdout));
});
