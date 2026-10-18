import { Effect } from "effect";
import { assetResolutionBoundary } from "./assetResolutionBoundary.ts";
import { boardStory } from "./boardStory.ts";

export const missingMermaid = boardStory.trait("project", "the Mermaid package cannot be resolved", function* () {
	assetResolutionBoundary.missing = true;
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			assetResolutionBoundary.missing = false;
		}),
	);
});
