import { realpathSync } from "node:fs";
import { Data, Effect } from "effect";
import type ts from "typescript";
import { defineService } from "@shivaedev/service/defineService.ts";
import { browserChecker } from "#adapters/imports/browserChecker.ts";
import { departures } from "#adapters/imports/departures.ts";
import { graph } from "#adapters/imports/graph.ts";
import type { WorkspacePackage } from "#imports/workspace.ts";
import type { RuleInputs } from "#rule.ts";

export class ImportAnalysisFailure extends Data.TaggedError("ImportAnalysisFailure")<{
	readonly message: string;
	readonly root: string;
}> {}

function failure(root: string, cause: unknown): ImportAnalysisFailure {
	return new ImportAnalysisFailure({ message: `Cannot analyze imports in ${root}: ${cause instanceof Error ? cause.message : String(cause)}`, root });
}

export const ImportCompiler = defineService({
	id: "@shivaedev/quality/ImportCompiler",
	initialize: Effect.void,
	methods: () => ({
		browserChecker: (source: ts.SourceFile) => Effect.sync(() => browserChecker(source)),
		departures: (inputs: RuleInputs, packages: readonly WorkspacePackage[]) =>
			Effect.try({ catch: (cause) => failure(inputs.root, cause), try: () => departures(inputs, packages) }),
		graph: (inputs: RuleInputs) => Effect.try({ catch: (cause) => failure(inputs.root, cause), try: () => graph(inputs, realpathSync(inputs.root)) }),
	}),
	requires: [],
});
