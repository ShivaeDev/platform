import { realpathSync } from "node:fs";
import { join } from "node:path";
import { projectsFor } from "#adapters/imports/projects.ts";
import { resolveImport } from "#adapters/imports/resolve.ts";
import type { RuleInputs } from "#rule.ts";

export interface FakeModule {
	readonly file: string;
	readonly line: number;
	readonly specifier: string;
}

export function fakeTargets(inputs: RuleInputs, modules: readonly FakeModule[]) {
	const root = realpathSync(inputs.root);
	const projectOf = projectsFor(root);
	return modules.flatMap((module) => {
		const from = join(root, module.file);
		const target = resolveImport(root, () => false, { ...module, kind: "import", type: false }, from, projectOf(from));
		return target?.kind === "file" ? [{ ...module, target: target.path }] : [];
	});
}
