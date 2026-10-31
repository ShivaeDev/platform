import { Effect, Schema } from "effect";
import { Invalid } from "#shape.ts";
import { formStories } from "./formStories.ts";

export const RequiredFields = Schema.Struct({
	code: Schema.String.check(Schema.isMinLength(3)),
	name: Schema.NonEmptyString,
	role: Schema.NonEmptyString,
	slug: Schema.String.check(Schema.isNonEmpty({ message: "Choose a slug" })),
});

export const requiredConfig = {
	initialValues: { code: "ab", name: "", role: "", slug: "" },
	onSubmit: Effect.succeed,
	requiredMessages: { code: "Enter a code", name: "Enter your name", role: "Choose a role", slug: "Enter a slug" },
};

export const required = formStories(() => RequiredFields, {
	config: () => requiredConfig,
	support: () => undefined,
	verbs: (driver) => ({
		submissionMessages: () =>
			driver
				.result()
				.pipe(Effect.match({ onFailure: (error) => (error instanceof Invalid ? error.messages : undefined), onSuccess: () => undefined })),
	}),
});
