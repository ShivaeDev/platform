import { join } from "node:path";
import { Effect } from "effect";
import { packageOf, workspacePackages } from "#imports/workspace.ts";
import { readPackageManifest } from "#manifestInventory.ts";
import { defineRule, type Finding, type RuleInputs } from "#rule.ts";
import { effectPrograms } from "#rules/effect/program.ts";
import { serviceCatalog } from "#rules/effect/serviceCatalog.ts";
import { serviceFindings } from "#rules/effect/serviceFindings.ts";

export const serviceParameters = defineRule({
	check: Effect.fn("Services.check")(function* (inputs: RuleInputs) {
		const packages = yield* workspacePackages(inputs);
		const root = yield* readPackageManifest(inputs.readText, "package.json");
		const names = [...packages.map((owner) => owner.name), ...(root?.name === undefined ? [] : [root.name])];
		const groups = new Map<string, RuleInputs["sources"][number][]>();
		for (const source of inputs.sources) {
			if (/(?:^|\/)test-support\//u.test(source.path)) {
				continue;
			}
			const group = packageOf(packages, source.path)?.directory ?? ".";
			const files = groups.get(group) ?? [];
			files.push(source);
			groups.set(group, files);
		}
		const programs = effectPrograms(inputs);
		const findings: Finding[] = [];
		for (const files of groups.values()) {
			const program = programs.create(files);
			const checker = program.getTypeChecker();
			const sources = files.flatMap((file) => {
				const source = program.getSourceFile(join(inputs.root, file.path));
				return source === undefined ? [] : [source];
			});
			findings.push(...serviceFindings(inputs.root, sources, checker, serviceCatalog(program, checker, names)));
			programs.release();
		}
		return findings;
	}),
	description:
		"Exported and local functions and public methods take services from Effect's environment, including aliases, constraints, inferred/destructured parameters and factory returns. Service keys/classes, non-empty Contexts and implementation shapes are services; Effect/Stream requirements are computations. Service implementation methods, framework callbacks, module-level React components and their props, owned initializer state, foreign host callbacks in object literals and classes, owned foreign adapter resources, Layer constructors, registries and RPC clients held by plain functions outside Effect bodies, and tags only handed to middleware declarations or Context.pick are accepted. Within Effect code, test-support/ folders are exempt. The fixed adapters/ convention bridges outside libraries to Effect values; adapters still follow this rule and ambient runtime bans. No config exceptions or inline suppressions; baseline existing debt.",
	id: "effect/service-parameters",
	registrable: false,
});
