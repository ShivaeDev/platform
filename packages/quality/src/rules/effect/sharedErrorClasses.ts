import { defineRule } from "#rule.ts";
import { packageFindings } from "#rules/packageFindings.ts";

export const sharedErrorClasses = defineRule({
	check: (inputs) => packageFindings(inputs, "effect/shared-error-classes"),
	description:
		"A tagged error with a tag exported by @shivaedev/errors must use that exported class. Import the shared class instead of declaring another error or subclass with its tag.",
	id: "effect/shared-error-classes",
	registrable: false,
});
