import { Effect } from "effect";
import { planDiff, validateDiff } from "@shivaedev/changesets/check.ts";
import { attempt } from "@shivaedev/changesets/error.ts";
import { computePlan } from "@shivaedev/changesets/planner.ts";
import { readHistory } from "@shivaedev/changesets/readHistory.ts";
import { readWorkspace } from "@shivaedev/changesets/workspace.ts";
import config from "#release-config";
import { starterPinsInput } from "./starterPinsInput.ts";

export const validateRelease = Effect.fn("Release.validateRelease")(function* (
	root: string,
	pins: Readonly<Record<string, string>>,
	reference?: string,
) {
	const after = yield* readWorkspace(root, config);
	const before = yield* readHistory(root, config, reference);
	yield* attempt(() => {
		computePlan(after.packages, after.changesets);
		const input = starterPinsInput(planDiff(before, after), pins);
		validateDiff(input === undefined ? before : { ...before, changesets: [...before.changesets, input] }, after);
	});
});
