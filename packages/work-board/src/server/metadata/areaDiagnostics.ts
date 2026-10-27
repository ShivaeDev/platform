import { Effect, Option, Path } from "effect";
import { isDirectory, repositoryRoot } from "./areaFolders.ts";
import { areaSuggestion } from "./areaSuggestion.ts";
import type { Diagnostic, ParsedMetadata } from "./parse.ts";

function isAreaPath(area: string) {
	const segments = area.split("/");
	return (
		!(area.includes("\\") || ["packages", "examples"].includes(segments[0] ?? ""))
		&& segments.every((segment) => segment !== "" && segment !== "." && segment !== "..")
	);
}

export const areaDiagnostics = Effect.fn("WorkBoard.areaDiagnostics")(function* (root: string, parsed: ParsedMetadata) {
	const areas = parsed.fields.areas?.filter((area) => area !== "*") ?? [];
	if (areas.length === 0) {
		return [];
	}
	const path = yield* Path.Path;
	const repository = yield* repositoryRoot(root);
	const diagnostics: Diagnostic[] = [];
	for (const area of areas) {
		const locations = ["packages", "examples", ""].map((prefix) => path.join(repository, prefix, area));
		if (isAreaPath(area) && Option.isSome(yield* Effect.findFirst(locations, isDirectory))) {
			continue;
		}
		const suggestion = yield* areaSuggestion(repository, area);
		diagnostics.push({
			field: "areas",
			line: parsed.lines.areas ?? 2,
			message: `Area "${area}" does not name an existing repository folder.${suggestion === undefined ? "" : ` Did you mean "${suggestion}"?`}`,
		});
	}
	return diagnostics;
});
