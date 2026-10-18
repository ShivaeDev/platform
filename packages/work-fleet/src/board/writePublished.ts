import { constants } from "node:fs";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { Effect } from "effect";
import { type ReportDirectory, validateReportDirectory, withReportDirectory } from "#reportFileDirectory.ts";
import { hasFileCode, ReportFileFailure, reportFileIo, withReportFile } from "#reportFileFailure.ts";

function unchanged(
	folder: string,
	name: "status.md" | "health.json" | ".fleet-decision-closure-v1.json",
	content: string,
	owns: (source: string) => boolean,
) {
	const label = `fleet/${name}`;
	return withReportFile(
		label,
		() => open(`${folder}/${name}`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK),
		(previous) =>
			Effect.gen(function* () {
				const stat = yield* reportFileIo(label, () => previous.stat());
				if (!stat.isFile() || stat.size > 8 * 1024 * 1024) {
					return yield* Effect.fail(new ReportFileFailure({ path: label, reason: "Publication target must be a regular file under 8 MiB" }));
				}
				const source = yield* reportFileIo(label, () => readFile(previous, "utf8"));
				if (!owns(source)) {
					return yield* Effect.fail(new ReportFileFailure({ path: label, reason: "Publication target contains authored content" }));
				}
				return source === content;
			}),
	).pipe(Effect.catchTag("ReportFileFailure", (error) => (hasFileCode(error.cause, "ENOENT") ? Effect.succeed(false) : Effect.fail(error))));
}

const publish = Effect.fnUntraced(function* (
	directory: ReportDirectory,
	target: ReportDirectory,
	name: "status.md" | "health.json" | ".fleet-decision-closure-v1.json",
	content: string,
	owns: (source: string) => boolean,
) {
	const label = `fleet/${name}`;
	if (yield* unchanged(target.folder, name, content, owns)) {
		return;
	}
	const temporary = `${target.folder}/.${name}-${crypto.randomUUID()}.tmp`;
	yield* Effect.acquireUseRelease(
		reportFileIo(label, () => open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600)),
		(file) =>
			Effect.gen(function* () {
				yield* reportFileIo(label, () => file.writeFile(content, "utf8"));
				yield* reportFileIo(label, () => file.sync());
				yield* validateReportDirectory(label, directory);
				yield* validateReportDirectory(label, target);
				yield* reportFileIo(label, () => rename(temporary, `${target.folder}/${name}`));
				yield* reportFileIo(label, () => target.file.sync());
			}),
		(file) => reportFileIo(label, () => file.close()).pipe(Effect.onExit(() => reportFileIo(label, () => rm(temporary, { force: true })))),
	);
});

export const writePublished = Effect.fn("Fleet.writePublished")(function* (
	root: string,
	realRoot: string,
	name: "status.md" | "health.json" | ".fleet-decision-closure-v1.json",
	content: string,
	owns: (source: string) => boolean,
) {
	const upgrade = name === ".fleet-decision-closure-v1.json";
	const label = upgrade ? name : `fleet/${name}`;
	return yield* withReportDirectory(label, root, realRoot, (directory) =>
		Effect.gen(function* () {
			if (upgrade) {
				return yield* publish(directory, directory, name, content, owns);
			}
			yield* reportFileIo(label, () => mkdir(`${directory.folder}/fleet`)).pipe(
				Effect.catchTag("ReportFileFailure", (error) => (hasFileCode(error.cause, "EEXIST") ? Effect.void : Effect.fail(error))),
			);
			return yield* withReportDirectory(label, `${directory.folder}/fleet`, `${realRoot}/fleet`, (target) =>
				publish(directory, target, name, content, owns),
			);
		}),
	);
});
