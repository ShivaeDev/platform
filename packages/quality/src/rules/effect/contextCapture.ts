import { contextCaptureFindings } from "#adapters/contextCaptureFindings.ts";
import { defineRule } from "#rule.ts";

export const contextCapture = defineRule({
	check: contextCaptureFindings,
	description:
		"Core code yields dependencies and the caller rather than re-providing captured contexts with Effect.provideContext, runPromiseWith, runForkWith or the Context overload of provide. Contexts assembled from Layers at composition roots and fully provided application harnesses are accepted. Runtime bridges belong in adapters/ or test-support/.",
	id: "effect/context-capture",
	registrable: false,
});
