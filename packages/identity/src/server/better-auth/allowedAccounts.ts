import { Config, Schema, SchemaGetter } from "effect";

const ProviderAccount = Schema.Struct({ accountId: Schema.NonEmptyString, providerId: Schema.NonEmptyString });

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
