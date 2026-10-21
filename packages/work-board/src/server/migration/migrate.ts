import { Effect, FileSystem, Path } from "effect";
import { migrateSource } from "./source.ts";
import { sourceHeader } from "./sourceHeader.ts";
import { waitingQuestions } from "./waitingQuestions.ts";

export const migrate = Effect.fn("WorkBoard.migrate")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const files: { file: string; source: string }[] = [];
	const scan = Effect.fn("BoardMigration.scan")(function* (directory: string): Effect.fn.Return<void, import("effect/PlatformError").PlatformError> {
		for (const name of yield* fs.readDirectory(directory)) {
			const file = path.join(directory, name);
			const stat = yield* fs.stat(file);
			if (stat.type === "Directory") {
				yield* scan(file);
			} else if (/\.md$/iu.test(file)) {
				files.push({ file, source: yield* fs.readFileString(file) });
			}
		}
	});
	yield* scan(root);
	const blocking = waitingQuestions(files);
	const replacements = new Map<string, string[]>();
	for (const { source } of files) {
		const header = sourceHeader(source);
		if (!header) {
			continue;
		}
		const data = header.doc.toJS();
		if (data.status === "superseded" && typeof (data.superseded_by ?? data.replaced_by) === "string" && typeof data.id === "string") {
			const successor = data.superseded_by ?? data.replaced_by;
			replacements.set(successor, [...(replacements.get(successor) ?? []), data.id]);
		}
	}
	let changedFiles = 0;
	let changedFields = 0;
	for (const { file, source } of files) {
		const data = sourceHeader(source)?.doc.toJS();
		const replaces = (replacements.get(data?.id) ?? []).filter(
			(id) => !data.relationships?.some((link: { kind: string; target: string }) => link.kind === "replaces" && link.target === id),
		);
		const result = migrateSource(source, { blocking, replaces });
		if (result.source === source) {
			continue;
		}
		yield* fs.writeFileString(file, result.source);
		changedFiles += 1;
		changedFields += result.fields;
	}
	return { fields: changedFields, files: changedFiles };
});
