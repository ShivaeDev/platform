import { Effect, Schema } from "effect";
import { AgentResult, Text } from "./domain.ts";
import { failure } from "./ports.ts";
export const RpcMessage = Schema.Struct({
	error: Schema.optional(Schema.Struct({ code: Schema.Number, message: Schema.String })),
	id: Schema.optional(Schema.Union([Schema.Number, Schema.String])),
	method: Schema.optional(Schema.String),
	result: Schema.optional(Schema.Unknown),
});
export const ThreadStarted = Schema.Struct({ thread: Schema.Struct({ id: Text }) });
export const TurnStarted = Schema.Struct({ turn: Schema.Struct({ id: Text }) });
export const ThreadRead = Schema.Struct({
	thread: Schema.Struct({
		id: Text,
		status: Schema.Struct({ type: Schema.String }),
		turns: Schema.Array(
			Schema.Struct({
				id: Text,
				items: Schema.Array(
					Schema.Struct({
						content: Schema.optional(Schema.Array(Schema.Struct({ text: Schema.optional(Schema.String), type: Schema.String }))),
						phase: Schema.optional(Schema.NullOr(Schema.String)),
						text: Schema.optional(Schema.String),
						type: Schema.String,
					}),
				),
				status: Schema.String,
			}),
		),
	}),
});
export const ChatGptAccount = Schema.Struct({ account: Schema.NullOr(Schema.Struct({ type: Schema.String })) });
export function decode<T extends Schema.Constraint>(schema: T, value: unknown) {
	return Schema.decodeUnknownEffect(schema)(value).pipe(Effect.mapError(() => failure("Codex returned an incompatible protocol response")));
}
export function decodeJson(text: string) {
	return Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))(text).pipe(Effect.mapError(() => failure("Codex returned invalid JSON")));
}
export function decodeResult(text: string) {
	return decodeJson(text).pipe(Effect.flatMap((value) => decode(AgentResult, value)));
}
