import { Effect, Schema, SchemaIssue } from "effect";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { SessionUserSchema, type SessionUserWithProviderAccountsValue } from "#identity.ts";

const standardIssues = SchemaIssue.makeFormatterStandardSchemaV1();

// Only the top-level key of each issue is logged: the formatted messages quote the provider's values.
function invalidFields(issue: SchemaIssue.Issue) {
	const fields = standardIssues(issue).issues.flatMap(({ path }) => {
		const [field] = path ?? [];
		return field === undefined ? [] : [String(typeof field === "object" ? field.key : field)];
	});
	return [...new Set(fields)].join(", ");
}

function sessionUserDecoder<TSchema extends Schema.Decoder<unknown>>(schema: TSchema) {
	const decode = Schema.decodeUnknownEffect(schema);
	return (user: unknown): Effect.Effect<TSchema["Type"], AuthUnavailable> =>
		decode(user, { errors: "all" }).pipe(
			Effect.catchTag("SchemaError", ({ issue }) =>
				Effect.andThen(
					Effect.logError(
						`The session provider returned a user without a valid ${invalidFields(issue)}, so the request fails with AuthUnavailable. A provider that serves SessionUser returns id, name, email and emailVerified on its user.`,
					),
					Effect.fail(new AuthUnavailable({ message: "Authentication is temporarily unavailable" })),
				),
			),
		);
}

export const decodeSessionUser = sessionUserDecoder(SessionUserSchema);
export const decodeProviderAccountsUser = sessionUserDecoder(
	Schema.Struct({
		...SessionUserSchema.fields,
		providerAccounts: Schema.declare((value): value is SessionUserWithProviderAccountsValue["providerAccounts"] => Effect.isEffect(value)),
	}),
);
