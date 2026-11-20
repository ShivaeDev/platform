import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { successOf } from "#test/generatedText.ts";
import { generatedOnce, generator, publicShapeProject, serverOnlyProject } from "#test/generator.ts";

const ACCOUNTS = "src/generated/modules/accounts/accounts.ts";
const CREDENTIALS = "src/generated/modules/credentials/credentials.ts";
const INSTEAD = "which never leaves the server; return a public shape without that field, such as an object of the fields the browser needs";

const REFUSALS = {
	returnsAccount: `accounts.returnsAccount: run returns a Redacted value at success.credentials[number].digest, a field of the Schema class Account, ${INSTEAD}`,
	returnsFolder: `accounts.returnsFolder: run returns a Redacted value at success.key, a field of the Schema class Folder, ${INSTEAD}`,
	returnsGrant: `accounts.returnsGrant: run returns a Redacted value at success.refresh.value, a field of the Schema class Grant, ${INSTEAD}`,
	returnsMaybeToken: `accounts.returnsMaybeToken: run returns a Redacted value at success.token<Some>, ${INSTEAD}`,
	returnsNullableToken: `accounts.returnsNullableToken: run returns a Redacted value at success.token, ${INSTEAD}`,
	returnsRow: `accounts.returnsRow: run returns a Redacted value at success.digest, a field of the Schema class Credential, ${INSTEAD}`,
	returnsRows: `accounts.returnsRows: run returns a Redacted value at success.rows[number].digest, a field of the Schema class Credential, ${INSTEAD}`,
	returnsSession: `accounts.returnsSession: run returns a Redacted value at success.tokens[string], a field of the Schema class Session, ${INSTEAD}`,
	returnsSignIn: `accounts.returnsSignIn: run returns a Redacted value at success<_tag: Signed>.token, ${INSTEAD}`,
	returnsToken: `accounts.returnsToken: run returns a Redacted value at success.session.tokens[number], ${INSTEAD}`,
} as const;

generator.it(
	"generate refuses each operation whose success holds a Redacted, in a returned object, a union or an Option, or in a field of an exported Schema or Model class at any depth, including a class that holds itself, naming the field's path, and writes no file for the module",
	[serverOnlyProject()],
	function* ({ generatedFile, generates }) {
		const outcome = yield* generates();

		yield* outcomes([
			["generate", () => Effect.succeed(outcome.result), "failed"],
			...Object.entries(REFUSALS).map(
				([operation, message]) =>
					[
						operation,
						() => Effect.succeed(outcome.problems.find((problem) => problem.startsWith(`accounts.${operation}:`)) ?? "no message"),
						message,
					] as const,
			),
			["messages", () => Effect.succeed(outcome.problems.length), Object.keys(REFUSALS).length],
			["generated file", () => generatedFile(ACCOUNTS), "missing"],
		]);
	},
);

generator.it(
	"an operation that returns a stored credential's public fields travels as a struct without the server-only digest, and a sign-in payload keeps its Redacted password",
	[publicShapeProject(), generatedOnce()],
	function* ({ generatedFile }) {
		const text = yield* generatedFile(CREDENTIALS);

		yield* outcomes([
			[
				"holder's success",
				() => Effect.succeed(successOf(text, "holder")),
				"Schema.Struct({ id: Schema.mutableKey(Schema.Number), owner: Schema.mutableKey(Schema.String) })",
			],
			["generated file mentions the digest", () => Effect.succeed(text.includes("digest")), false],
			[
				"signIn's payload",
				() => Effect.succeed(text.includes("signIn: { owner: Schema.String, password: Schema.RedactedFromValue(Schema.String) }")),
				true,
			],
		]);
	},
);
