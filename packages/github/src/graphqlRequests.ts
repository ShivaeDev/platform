import { Effect, Schema } from "effect";
import { GitHubGraphqlError } from "#errors.ts";
import type { Representations } from "#representations.ts";

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

export function graphqlRequests(apiUrl: string, client: Representations) {
	return Effect.fn("GitHub.graphql")(function* (query: string, variables: unknown, options?: GraphqlOptions) {
		const url = new URL(options?.apiUrl ?? apiUrl);
		url.pathname = url.pathname.replace(/\/api\/v3\/?$/u, "/api/graphql");
		if (!url.pathname.endsWith("/api/graphql")) {
			url.pathname = `${url.pathname.replace(/\/$/u, "")}/graphql`;
		}
		const response = yield* client.write("POST", url.href, { query, variables }, options?.responseByteLimit);
		const body = yield* response.decode(Schema.Unknown);
		return { body, decode: <TSchema extends Schema.Constraint>(schema: TSchema) => decodeGraphqlData(body, schema) };
	});
}
