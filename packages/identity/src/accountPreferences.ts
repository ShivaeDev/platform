import { DateTime, Effect, Option, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { selfSubject } from "#subject.ts";

export const AccountTimezone = Schema.String.check(
	Schema.makeFilter((value) => Option.isSome(DateTime.zoneMakeNamed(value)), { expected: "an IANA timezone" }),
);

export const AccountPreferenceValues = Schema.Struct({
	locale: Schema.NonEmptyString,
	timezone: AccountTimezone,
	units: Schema.Literals(["metric", "imperial"]),
});

export const accountPreferenceKeys = collection("identity.accountPreferences", Schema.String);

export const AccountPreferences = contract("identity.accountPreferences", {
	commands: [
		command("capture", {
			invalidates: () => [accountPreferenceKeys.list],
			payload: AccountPreferenceValues.fields,
			rejections: { AuthUnavailable },
		}),
		command("set", {
			invalidates: () => [accountPreferenceKeys.list],
			payload: AccountPreferenceValues.fields,
			rejections: { AuthUnavailable },
		}),
	],
	queries: [
		query("get", {
			readPolicy: () => Effect.succeed(true),
			reads: () => [accountPreferenceKeys.list],
			rejections: { AuthUnavailable },
			success: AccountPreferenceValues,
		}),
	],
	subject: selfSubject,
});
