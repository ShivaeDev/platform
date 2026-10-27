import { Effect, Path } from "effect";
import { areaFolders, isDirectory, repositoryRoot } from "./areaFolders.ts";
import { areaSuggestion } from "./areaSuggestion.ts";
import type { Diagnostic, ParsedMetadata } from "./parse.ts";

function isAreaPath(area: string) {
	const segments = area.split("/");
	return (
		!(area.includes("\\") || ["packages", "examples"].includes(segments[0] ?? ""))
		&& segments.every((segment) => segment !== "" && segment !== "." && segment !== "..")
	);
}

export const areaDiagnostics = Effect.fn("WorkBoard.areaDiagnostics")(function* (root: string, parsed: ParsedMetadata, file = "") {
	if (parsed.fields.status === "done" || parsed.fields.status === "dropped" || file.startsWith("archive/")) {
		return [];
	}
	const areas = parsed.fields.areas?.filter((area) => area !== "*") ?? [];
	if (areas.length === 0) {
		return [];
	}
	const path = yield* Path.Path;
	const repository = yield* repositoryRoot(root);
	const bases = yield* areaFolders(repository);
	const diagnostics: Diagnostic[] = [];
	for (const area of areas) {
		const [name = "", ...folders] = area.split("/");
		const base = bases.get(name);
		const location = base && (folders.length === 0 ? base.folder : path.join(base.subfolders, ...folders));
		if (isAreaPath(area) && location !== undefined && (yield* isDirectory(location))) {
			continue;
		}
		const suggestion = yield* areaSuggestion(bases, area);
		diagnostics.push({
			field: "areas",
			line: parsed.lines.areas ?? 2,
			message: `Area "${area}" does not name an existing repository folder.${suggestion === undefined ? "" : ` Did you mean "${suggestion}"?`}`,
		});
	}
	return diagnostics;
});
