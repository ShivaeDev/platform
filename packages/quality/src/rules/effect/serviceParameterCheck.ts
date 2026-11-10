import { Effect } from "effect";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { workspacePackages } from "#imports/workspace.ts";
import type { RuleInputs, SourceFile, TypeScriptProgram } from "#rule.ts";
import { serviceCatalog } from "#rules/effect/serviceCatalog.ts";
import { serviceFindings } from "#rules/effect/serviceFindings.ts";

export const serviceParameterCheck = Effect.fn("Services.serviceParameterCheck")(function* (inputs: RuleInputs) {
	const packages = yield* workspacePackages(inputs);
	const root = yield* readPackageManifest(inputs.readText, "package.json");
	const names = [...packages.map((owner) => owner.name), ...(root?.name === undefined ? [] : [root.name])];
	return {
		checks: (file: SourceFile) => !/(?:^|\/)test-support\//u.test(file.path),
		findings: (files: readonly SourceFile[], { checker, program, sourceFile }: TypeScriptProgram) =>
			serviceFindings(
				inputs.root,
				files.flatMap((file) => sourceFile(file.path) ?? []),
				checker,
				serviceCatalog(program, checker, names),
			),
	};
});
