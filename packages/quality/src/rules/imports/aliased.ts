import { Effect } from "effect";
import { type Departure, departures } from "#imports/departures.ts";
import { defineRule } from "#rule.ts";

function messageOf({ installed, specifier, workspace }: Departure): string {
	const relative = `"${specifier}" is a relative import.`;
	if (installed !== undefined) {
		return `${relative} It reaches into the installed package ${installed}; import that package by its name.`;
	}
	if (workspace !== undefined) {
		return `${relative} It reaches into the workspace package ${workspace}; import it by that name, through a path its package.json "exports" lists.`;
	}
	return `${relative} Import it through a "#…" alias from the "imports" of its package.json, and declare one there if none fits.`;
}

export const importsAliased = defineRule({
	check: (inputs) =>
		Effect.map(departures(inputs), (found) =>
			found.map((departure) => ({
				file: departure.file,
				line: departure.line,
				message: messageOf(departure),
				subject: departure.specifier,
			})),
		),
	description:
		"Import own modules through the package.json `imports` aliases, including same-folder modules. Import other packages by their names and exported paths.",
	id: "imports/aliased",
});
