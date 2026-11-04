import { Effect } from "effect";
import type { WorkspacePackage } from "#imports/workspace.ts";
import type { RuleInputs } from "#rule.ts";
import { analysisFailure } from "./analysisFailure.ts";
import { departures } from "./departures.ts";

export const analyzeDepartures = Effect.fn("ImportCompiler.analyzeDepartures")((inputs: RuleInputs, packages: readonly WorkspacePackage[]) =>
	Effect.try({ catch: (cause) => analysisFailure(inputs.root, cause), try: () => departures(inputs, packages) }),
);
