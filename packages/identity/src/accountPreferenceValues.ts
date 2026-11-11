import { DateTime, Option, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";

export const AccountTimezone = Schema.String.check(
	Schema.makeFilter((value) => Option.isSome(DateTime.zoneMakeNamed(value)), { expected: "an IANA timezone" }),
);

export const AccountPreferenceValues = Schema.Struct({
	locale: Schema.NonEmptyString,
	timezone: AccountTimezone,
	units: Schema.Literals(["metric", "imperial"]),
});

export const accountPreferenceKeys = collection("identity.accountPreferences", Schema.String);
