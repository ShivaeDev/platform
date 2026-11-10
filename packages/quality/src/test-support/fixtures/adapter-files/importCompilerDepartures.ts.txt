import { Effect } from "effect";
import { departures as findDepartures } from "#adapters/imports/departures.ts";
import { analysisFailure } from "#imports/analysisFailure.ts";
import type { WorkspacePackage } from "#imports/workspace.ts";
import type { RuleInputs } from "#rule.ts";

export const departures = Effect.fn("ImportCompiler.departures")((inputs: RuleInputs, packages: readonly WorkspacePackage[]) =>
	Effect.try({ catch: (cause) => analysisFailure(inputs.root, cause), try: () => findDepartures(inputs, packages) }),
);
