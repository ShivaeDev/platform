import { Effect, FileSystem, Path } from "effect";
import { decisionAnswers } from "#server/migration/decisionAnswers.ts";
import { replacements } from "#server/migration/replacements.ts";
import { migrateSource } from "#server/migration/source.ts";
import { sourceHeader } from "#server/migration/sourceHeader.ts";
import { validateFiles } from "#server/migration/validateFiles.ts";
import { waitingQuestions } from "#server/migration/waitingQuestions.ts";

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
				files.push({ file: path.relative(root, file), source: yield* fs.readFileString(file) });
			}
		}
	});
	yield* scan(root);
	const prepared = files.map(({ file, source }) => ({
		file,
		...migrateSource(source, { answers: new Set(), blocking: new Set(), file, replaces: [] }),
	}));
	const documents = yield* validateFiles(prepared);
	const answers = decisionAnswers(files, documents);
	const blocking = waitingQuestions(files);
	const { links, unresolved } = replacements(files);
	const changes = files.map(({ file, source }) => {
		const data = sourceHeader(source)?.doc.toJS();
		const replaces = (links.get(data?.id) ?? []).filter(
			(id) => !data.relationships?.some((link: { kind: string; target: string }) => link.kind === "replaces" && link.target === id),
		);
		return { file, ...migrateSource(source, { answers, blocking, file, replaces }) };
	});
	yield* validateFiles(changes);
	const changed = changes.filter((entry) => entry.fields > 0);
	for (const { file, source } of changed) {
		yield* fs.writeFileString(path.join(root, file), source);
	}
	return { fields: changed.reduce((total, entry) => total + entry.fields, 0), files: changed.length, unresolved };
});
