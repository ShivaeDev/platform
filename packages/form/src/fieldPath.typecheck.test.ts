import { Effect, Schema } from "effect";
import { expectTypeOf } from "vitest";
import { form } from "#form.ts";

const Profile = Schema.Struct({ name: Schema.String, surname: Schema.String });
const fields = form(
	Schema.Struct({
		explicit: Schema.UndefinedOr(Schema.String),
		group: Schema.Struct({ name: Schema.String, note: Schema.optionalKey(Schema.String) }),
		note: Schema.optionalKey(Schema.String),
		nullable: Schema.NullOr(Profile),
		profile: Schema.optionalKey(Profile),
	}),
	{
		initialValues: { explicit: undefined, group: { name: "Ada" }, nullable: null },
		onSubmit: Effect.succeed,
	},
);

expectTypeOf(fields.fieldAt(["profile"]).value).toEqualTypeOf<typeof Profile.Encoded | undefined>();
expectTypeOf(fields.fieldAt(["nullable"]).value).toEqualTypeOf<typeof Profile.Encoded | null>();
// @ts-expect-error Optional groups are read and replaced as complete values.
fields.fieldAt(["profile", "name"]);
// @ts-expect-error A nullable group cannot promise that its child exists.
fields.fieldAt(["nullable", "name"]);
// @ts-expect-error A child write cannot create a group with missing required siblings.
fields.changeAt(["profile", "name"], "Ada");
// @ts-expect-error Native prop traversal also requires a present parent.
fields.field("profile").prop("name");
// @ts-expect-error Creating a group requires all its required siblings.
fields.change("profile", { name: "Ada" });
fields.change("profile", { name: "Ada", surname: "Lovelace" });
fields.omit("note");
fields.omit("profile");
fields.omitAt(["group", "note"]);
// @ts-expect-error Required keys cannot be omitted even when undefined is a permitted value.
fields.omit("explicit");
// @ts-expect-error Required nested keys cannot be omitted.
fields.omitAt(["group", "name"]);
// @ts-expect-error Omission cannot traverse an optional parent.
fields.omitAt(["profile", "name"]);
fields.change("explicit", undefined);
