import { Effect } from "effect";
import { planDiff, validateDiff } from "@shivaedev/releases/check.ts";
import { computePlan } from "@shivaedev/releases/planner.ts";
import { readHistory } from "@shivaedev/releases/readHistory.ts";
import { readWorkspace } from "@shivaedev/releases/workspace.ts";
import config from "#release-config";
import { starterPinsInput } from "./starterPinsInput.ts";

export const validateRelease = Effect.fn("Release.validateRelease")(function* (
	root: string,
	pins: Readonly<Record<string, string>>,
	reference?: string,
) {
	const after = yield* readWorkspace(root, config);
	const before = yield* readHistory(root, config, reference);
	yield* computePlan(after.packages, after.changesets);
	const input = starterPinsInput(yield* planDiff(before, after), pins);
	yield* validateDiff(input === undefined ? before : { ...before, changesets: [...before.changesets, input] }, after);
});
