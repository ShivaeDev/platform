import { Effect } from "effect";
import { packageOf, workspacePackages } from "#imports/workspace.ts";
import { testName } from "#naming/testName.ts";
import type { RuleInputs } from "#rule.ts";
import { storyPrerequisites } from "./prerequisites.ts";
import { isSpec } from "./syntax.ts";

export const storySpecSources = Effect.fn("Stories.storySpecSources")(function* (inputs: RuleInputs) {
	const packages = yield* Effect.promise(() => workspacePackages(inputs));
	const exempt = yield* Effect.promise(() => storyPrerequisites(inputs, packages));
	return inputs.sources.filter((file) => {
		const modifiers = testName(file.path)?.modifiers ?? [];
		return (
			isSpec(file.path)
			&& !modifiers.includes("typecheck")
			&& !modifiers.includes("unit")
			&& !exempt.has(packageOf(packages, file.path)?.directory ?? "")
		);
	});
});
