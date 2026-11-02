import { sharedErrorFindings } from "#adapters/sharedErrorFindings.ts";
import { defineRule } from "#rule.ts";

export const sharedErrorClasses = defineRule({
	check: sharedErrorFindings,
	description:
		"A tagged error with a tag exported by @shivaedev/errors must use that exported class. Import the shared class instead of declaring another error or subclass with its tag.",
	id: "effect/shared-error-classes",
	registrable: false,
});
