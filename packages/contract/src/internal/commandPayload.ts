import { Effect, Predicate, Schema } from "effect";
import type { CommandShape } from "#operation.ts";

export function commandPayload(command: CommandShape, payload: unknown) {
	if (!(Predicate.hasProperty(command.Rejection, "BadRequest") && Schema.isSchema(command.Rejection.BadRequest))) {
		return Effect.succeed(payload);
	}
	const rejection = command.Rejection.BadRequest;
	return command.payload.makeEffect(payload).pipe(
		Effect.mapError((issue) => new Schema.SchemaError(issue)),
		Effect.tap(Schema.encodeUnknownEffect(Schema.toCodecJson(command.payload))),
		Effect.catchTag("SchemaError", (error) =>
			Schema.decodeUnknownEffect(rejection)({ _tag: "BadRequest", message: error.message }).pipe(Effect.orDie, Effect.flatMap(Effect.fail)),
		),
	);
}
