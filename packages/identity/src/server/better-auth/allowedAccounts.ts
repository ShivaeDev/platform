import { Config, Result, Schema, SchemaGetter } from "effect";

const GitHubAccountId = Schema.String.check(Schema.isPattern(/^[0-9]+$/u, { expected: "a numeric GitHub account id (digits only)" }));

const ProviderAccount = Schema.Struct({ accountId: Schema.String, providerId: Schema.NonEmptyString }).check(
	Schema.makeFilter(({ accountId, providerId }) => {
		const accountIdSchema = providerId === "github" ? GitHubAccountId : Schema.NonEmptyString;
		const decoded = Schema.decodeUnknownResult(accountIdSchema)(accountId);
		return Result.isSuccess(decoded) ? true : `Invalid entry "${providerId}:${accountId}": ${decoded.failure.message}`;
	}),
);

const AccountEntry = Schema.String.pipe(
	Schema.decodeTo(ProviderAccount, {
		decode: SchemaGetter.transform((entry) => {
			const separator = entry.indexOf(":");
			return separator < 0
				? { accountId: "", providerId: entry }
				: { accountId: entry.slice(separator + 1).trim(), providerId: entry.slice(0, separator).trim() };
		}),
		encode: SchemaGetter.transform(({ accountId, providerId }) => `${providerId}:${accountId}`),
	}),
);

export const AllowedAccounts = Schema.String.pipe(
	Schema.decodeTo(Schema.Array(AccountEntry).check(Schema.isMinLength(1)), {
		decode: SchemaGetter.transform((value) =>
			value
				.split(",")
				.map((entry) => entry.trim())
				.filter((entry) => entry.length > 0),
		),
		encode: SchemaGetter.transform((entries) => entries.join(",")),
	}),
);

export const allowedAccounts = Config.schema(AllowedAccounts, "AUTH_ALLOWED_ACCOUNTS");
