import { Effect } from "effect";
import { planDiff, validateDiff } from "@shivaedev/releases/check.ts";
import { checkReleaseCoverage } from "@shivaedev/releases/checkReleaseCoverage.ts";
import { computePlan } from "@shivaedev/releases/planner.ts";
import { readHistory } from "@shivaedev/releases/readHistory.ts";
import { readWorkspace } from "@shivaedev/releases/workspace.ts";
import { declarationDriftInput } from "#release/declarationDriftInput.ts";
import { starterPinsInput } from "#release/starterPinsInput.ts";
import config from "#release-config";

export const validateRelease = Effect.fn("Release.validateRelease")(function* (
	root: string,
	pins: Readonly<Record<string, string>>,
	reference?: string,
) {
	const after = yield* readWorkspace(root, config);
	let before = yield* readHistory(root, config, reference);
	yield* computePlan(after.packages, after.changesets, before.packages);
	const initial = yield* planDiff(before, after);
	if (
		after.packages.some((pkg) =>
			before.packages.some((old) => old.manifest.name === pkg.manifest.name && old.manifest.version !== pkg.manifest.version),
		)
	) {
		const driftInput = yield* declarationDriftInput(root, before.packages, initial);
		if (driftInput !== undefined) {
			before = { ...before, changesets: [...before.changesets, driftInput] };
		}
	}
	const plan = yield* planDiff(before, after);
	const input = starterPinsInput(plan, pins);
	const releaseBase = input === undefined ? before : { ...before, changesets: [...before.changesets, input] };
	yield* validateDiff(releaseBase, after);
	const collected = input === undefined ? plan : yield* planDiff(releaseBase, after);
	yield* checkReleaseCoverage(root, collected, after.changesets, reference);
	return collected;
});
