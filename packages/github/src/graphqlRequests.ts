import { Effect, Schema } from "effect";
import { GitHubGraphqlError } from "#errors.ts";

const Envelope = Schema.Struct({
	data: Schema.optionalKey(Schema.Unknown),
	errors: Schema.optionalKey(Schema.Array(Schema.Struct({ message: Schema.String }))),
});

export interface GraphqlOptions {
	readonly apiUrl?: string;
	readonly responseByteLimit?: number;
}

export const decodeGraphqlData = Effect.fn("GitHub.decodeGraphqlData")(function* <TSchema extends Schema.Constraint>(body: unknown, schema: TSchema) {
	const envelope = yield* Schema.decodeUnknownEffect(Envelope)(body);
	const errors = envelope.errors ?? [];
	if (errors.length > 0 && (envelope.data === undefined || envelope.data === null)) {
		return yield* new GitHubGraphqlError({ errors });
	}
	const data = yield* Schema.decodeUnknownEffect(schema)(envelope.data);
	return { data, errors };
});
