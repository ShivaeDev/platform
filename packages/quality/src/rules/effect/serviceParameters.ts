import { join } from "node:path";
import { defineRule, type Finding, type RuleInputs } from "#rule.ts";
import { effectProgram } from "#rules/effect/program.ts";
import { serviceCatalog } from "#rules/effect/serviceCatalog.ts";
import { serviceFindings } from "#rules/effect/serviceFindings.ts";

export const serviceParameters = defineRule({
	check: (inputs) => {
		const groups = new Map<string, RuleInputs["sources"][number][]>();
		for (const source of inputs.sources) {
			if (/(?:^|\/)test-support\//u.test(source.path)) {
				continue;
			}
			const group = /^(?:packages|examples)\/[^/]+/u.exec(source.path)?.[0] ?? ".";
			const files = groups.get(group) ?? [];
			files.push(source);
			groups.set(group, files);
		}
		return [...groups.values()].flatMap((sources) => checkServices({ ...inputs, sources }));
	},
	description:
		"Exported functions and public methods take services from Effect's environment, including aliases, constraints, inferred/destructured parameters and factory returns. Service keys/classes, non-empty Contexts and implementation shapes are services; Effect/Stream requirements are computations. Service implementation methods and Layer constructors are accepted. Only test-support/ folders are exempt. The fixed adapters/ convention bridges outside libraries to Effect values; adapters still follow this rule and ambient runtime bans. No config exceptions or inline suppressions; baseline existing debt.",
	id: "effect/service-parameters",
	registrable: false,
});

function checkServices(inputs: RuleInputs): readonly Finding[] {
	const program = effectProgram(inputs);
	const checker = program.getTypeChecker();
	const sources = inputs.sources.flatMap((file) => {
		const source = program.getSourceFile(join(inputs.root, file.path));
		return source === undefined ? [] : [source];
	});
	return serviceFindings(inputs.root, sources, checker, serviceCatalog(program, checker));
}
