import { type Relocation, relocations } from "../../imports/aliases/relocations.ts";
import { defineRule } from "../../rule.ts";

function messageOf({ declarationOnly, replacement, specifier, target }: Relocation): string {
	const leaves = `"${specifier}" leaves its folder.`;
	if (replacement !== undefined) {
		return `${leaves} Import it as "${replacement}"; \`quality fix\` rewrites it.`;
	}
	if (declarationOnly) {
		return `${leaves} It resolves only to a declaration file, which a runtime import cannot load, so no alias can stand in for it.`;
	}
	if (target === undefined) {
		return `${leaves} It resolves to no file yet, so no alias can stand in for it. Import it through an alias once it exists.`;
	}
	if (target.kind === "external") {
		return `${leaves} It reaches into the installed package ${target.package}. Import the package by its name.`;
	}
	return `${leaves} No package.json alias loads ${target.path} under every condition. Declare one in package.json "imports", then run \`quality fix\`.`;
}

export const importsAliased = defineRule({
	check: async (inputs) =>
		(await relocations(inputs)).map((relocation) => ({
			file: relocation.file,
			line: relocation.line,
			message: messageOf(relocation),
			subject: relocation.specifier,
		})),
	description:
		"A relative import names only a file in its own folder. Every other import goes through an alias: the package.json `imports` of its package or another workspace package's name.",
	id: "imports/aliased",
});
