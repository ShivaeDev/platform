import { constants } from "node:fs";
import { type FileHandle, open } from "node:fs/promises";
import { Effect } from "effect";
import { publication } from "@shivaedev/work-board/integration/publication.ts";
import { reportFileIo, withReportFile } from "#reportFileFailure.ts";

export interface ReportDirectory {
	readonly expected: string;
	readonly file: FileHandle;
	readonly folder: string;
}

export function validateReportDirectory(label: string, directory: ReportDirectory) {
	return reportFileIo(label, () => publication.validateDirectory(directory.file, directory.folder, directory.expected));
}

export function withReportDirectory<A, E, R>(
	label: string,
	path: string,
	expected: string,
	use: (directory: ReportDirectory) => Effect.Effect<A, E, R>,
) {
	return withReportFile(
		label,
		() => open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW),
		(file) =>
			Effect.gen(function* () {
				const directory = { expected, file, folder: publication.directoryPath(file, expected) };
				yield* validateReportDirectory(label, directory);
				return yield* use(directory);
			}),
	);
}
