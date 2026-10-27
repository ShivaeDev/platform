import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Clock, Console, Effect, FileSystem } from "effect";
import { Argument, Command } from "effect/cli";
import { listMarkdown } from "#server/files/list.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { VERSION } from "#server/packageInfo.ts";
import { archiveDocuments } from "./documents.ts";

export const archive = Effect.fn("WorkBoard.archive")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const realRoot = yield* fs.realPath(root);
	const files = yield* listMarkdown(root, realRoot);
	const documents = yield* Effect.forEach(
		files.filter((file) => /^(?:tasks|archive)\//u.test(file.path)),
		(file) =>
			Effect.map(fs.readFileString(`${root}/${file.path}`), (source) => ({
				file: file.path,
				modified: file.modified,
				parsed: metadataParse(source),
			})),
	);
	return yield* archiveDocuments(root, documents, yield* Clock.currentTimeMillis);
});

export function runArchive() {
	const command = Command.make("archive", { dir: Argument.Directory("dir", { mustExist: true }) }, ({ dir }) =>
		archive(dir).pipe(Effect.flatMap((paths) => Console.log(`Moved ${paths.length / 2} briefs.`))),
	);
	Command.runWith(command, { version: VERSION })(process.argv.slice(3)).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
}
