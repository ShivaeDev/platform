import { Effect, Schema } from "effect";
import { formStories } from "#test/formStories.ts";

const Profile = Schema.Struct({ name: Schema.String, note: Schema.optionalKey(Schema.String), surname: Schema.String });
export const optionalFields = formStories(
	() =>
		Schema.Struct({
			explicit: Schema.optionalKey(Schema.UndefinedOr(Schema.String)),
			group: Profile,
			note: Schema.optionalKey(Schema.String),
			nullable: Schema.NullOr(Profile),
			profile: Schema.optionalKey(Profile),
		}),
	{
		config: () => ({ initialValues: { group: { name: "Ada", surname: "Lovelace" }, nullable: null }, onSubmit: Effect.succeed }),
		support: () => undefined,
		verbs: (driver, tell) => ({
			groupRead: () =>
				Effect.sync(() => ({
					nullable: driver.current().fieldAt(["nullable"]).value,
					profile: driver.current().fieldAt(["profile"]).value,
				})),
			keyPresent: (name: "note" | "explicit") => Effect.sync(() => Object.hasOwn(driver.current().values.value, name)),
			omitGroupNote: () =>
				Effect.sync(() => {
					tell("remove the group's note");
					driver.current().omitAt(["group", "note"]);
				}),
			savedKeyPresent: (name: "note" | "explicit") => driver.result().pipe(Effect.map((values) => Object.hasOwn(values, name))),
		}),
	},
);

export function profileRemoved() {
	return optionalFields.step("the profile is omitted", (driver) => driver.current().omit("profile"));
}
