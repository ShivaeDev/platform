import { Effect } from "effect";
import { contextCaptureCheck } from "#contextCaptureCheck.ts";
import { defineRule } from "#rule.ts";
import { rootedFindings } from "#rules/rootedFindings.ts";
import { skipsUnsafeFolder, unsafeFindings } from "#rules/unsafeFindings.ts";

export const contextCapture = defineRule({
	check: (inputs) =>
		Effect.map(
			rootedFindings(inputs, { ...contextCaptureCheck, checks: (file) => !skipsUnsafeFolder(inputs, file.path) && contextCaptureCheck.checks(file) }),
			unsafeFindings,
		),
	description:
		"Core code yields dependencies and the caller rather than re-providing captured contexts with Effect.provideContext, runPromiseWith, runForkWith or the Context overload of provide. Contexts assembled from Layers at composition roots and fully provided application harnesses are accepted. Runtime bridges belong in adapters/ or test-support/.",
	id: "effect/context-capture",
	needs: "type-checker",
	registrable: false,
});
