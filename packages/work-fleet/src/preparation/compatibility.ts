import { Effect } from "effect";
import type { MainObservation, Preparation, PreparationAssessment } from "#preparation/schema.ts";

export function pathsOverlap(left: string, right: string): boolean {
	return left === "." || right === "." || left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function keyOverlaps(left: string, right: string): boolean {
	return left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`);
}

function relevantPath(preparation: Preparation, observation: MainObservation, path: string): boolean {
	if (preparation.ownedPaths.some((owned) => pathsOverlap(owned, path))) {
		return true;
	}
	const coverage = preparation.configuration.find((entry) => entry.path === path);
	if (coverage !== undefined) {
		const changes = observation.configurationChanges.filter((entry) => entry.path === path);
		if (changes.length !== 1 || changes[0]?.complete !== true) {
			return true;
		}
		return changes[0].keys.some((changed) => coverage.relevantKeys.some((key) => keyOverlaps(key, changed)));
	}
	return [preparation.sourcePaths, preparation.setupPaths, preparation.dependencyPaths, preparation.qualityPaths, preparation.baselinePaths].some(
		(paths) => paths.some((context) => pathsOverlap(context, path)),
	);
}

export const assessPreparation = Effect.fn("Preparation.assessPreparation")(
	(preparation: Preparation, observation: MainObservation): Effect.Effect<PreparationAssessment> => {
		if (observation.fromRevision !== preparation.baseRevision || !observation.complete || observation.observedAt < preparation.observedAt) {
			return Effect.succeed({ _tag: "Reprepare", paths: observation.changedPaths, reason: "incomplete-observation" });
		}
		if (!observation.ancestor) {
			return Effect.succeed({ _tag: "Reprepare", paths: observation.changedPaths, reason: "not-ancestor" });
		}
		if (observation.revision !== preparation.baseRevision && !preparation.contextComplete) {
			return Effect.succeed({ _tag: "Reprepare", paths: observation.changedPaths, reason: "incomplete-context" });
		}
		const paths = observation.changedPaths.filter((path) => relevantPath(preparation, observation, path));
		if (paths.length > 0) {
			return Effect.succeed({ _tag: "Reprepare", paths, reason: "relevant-change" });
		}
		return Effect.succeed({
			_tag: "Compatible",
			preparation: { ...preparation, baseRevision: observation.revision, observedAt: observation.observedAt },
		});
	},
);
