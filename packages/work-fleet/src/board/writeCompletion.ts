import { constants } from "node:fs";
import { open, readFile, rename, rm } from "node:fs/promises";
import { Effect } from "effect";
import { type ReportDirectory, validateReportDirectory, withReportDirectory } from "#reportFileDirectory.ts";
import { reportFileIo, withReportFile } from "#reportFileFailure.ts";

function current(folder: string, name: string, source: string) {
	return withReportFile(
		name,
		() => open(`${folder}/${name}`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK),
		(file) =>
			Effect.gen(function* () {
				const stat = yield* reportFileIo(name, () => file.stat());
				return stat.isFile() && stat.size <= 8 * 1024 * 1024 && (yield* reportFileIo(name, () => readFile(file, "utf8"))) === source;
			}),
	);
}

const replace = Effect.fnUntraced(function* (
	directories: readonly ReportDirectory[],
	target: ReportDirectory,
	name: string,
	source: string,
	content: string,
) {
	if (!(yield* current(target.folder, name, source))) {
		return false;
	}
	if (source === content) {
		return true;
	}
	const temporary = `${target.folder}/.${name}-${crypto.randomUUID()}.tmp`;
	return yield* Effect.acquireUseRelease(
		reportFileIo(name, () => open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600)),
		(file) =>
			Effect.gen(function* () {
				yield* reportFileIo(name, () => file.writeFile(content, "utf8"));
				yield* reportFileIo(name, () => file.sync());
				for (const directory of directories) {
					yield* validateReportDirectory(name, directory);
				}
				if (!(yield* current(target.folder, name, source))) {
					return false;
				}
				yield* reportFileIo(name, () => rename(temporary, `${target.folder}/${name}`));
				yield* reportFileIo(name, () => target.file.sync());
				return true;
			}),
		(file) => reportFileIo(name, () => file.close()).pipe(Effect.onExit(() => reportFileIo(name, () => rm(temporary, { force: true })))),
	);
});

export function writeCompletion(root: string, realRoot: string, relative: string, source: string, content: string) {
	const parts = relative.split("/");
	const name = parts.pop();
	if (name === undefined || !name.endsWith(".md") || parts.some((part) => part === "" || part === "." || part === "..")) {
		return Effect.succeed(false);
	}
	function descend(
		directory: ReportDirectory,
		parents: readonly ReportDirectory[],
		index: number,
	): Effect.Effect<boolean, Effect.Error<ReturnType<typeof replace>>> {
		const directories = [...parents, directory];
		const part = parts[index];
		return part === undefined
			? replace(directories, directory, name ?? "", source, content)
			: withReportDirectory(relative, `${directory.folder}/${part}`, `${directory.expected}/${part}`, (child) =>
					descend(child, directories, index + 1),
				);
	}
	return withReportDirectory(relative, root, realRoot, (directory) => descend(directory, [], 0));
}
