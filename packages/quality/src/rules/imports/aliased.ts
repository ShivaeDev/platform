import { type Departure, departures } from "../../imports/departures.ts";
import { defineRule } from "../../rule.ts";

function messageOf({ installed, specifier, workspace }: Departure): string {
	const leaves = `"${specifier}" leaves its folder.`;
	if (installed !== undefined) {
		return `${leaves} It reaches into the installed package ${installed}; import that package by its name.`;
	}
	if (workspace !== undefined) {
		return `${leaves} It reaches into the workspace package ${workspace}; import it by that name, through a path its package.json "exports" lists.`;
	}
	return `${leaves} Import it through a "#…" alias from the "imports" of its package.json, and declare one there if none fits.`;
}

export const importsAliased = defineRule({
	check: async (inputs) =>
		(await departures(inputs)).map((departure) => ({
			file: departure.file,
			line: departure.line,
			message: messageOf(departure),
			subject: departure.specifier,
		})),
	description:
		"A relative import names only a file in its own folder. Every other import goes through an alias: the package.json `imports` of its package or another workspace package's name.",
	id: "imports/aliased",
});
