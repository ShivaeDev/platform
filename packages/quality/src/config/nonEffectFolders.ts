import { Schema } from "effect";

export function nonEffectFolderPath(folder: string): string {
	return folder
		.split("/")
		.filter((part) => part !== "" && part !== ".")
		.join("/");
}

const Folder = Schema.NonEmptyString.check(
	Schema.makeFilter(
		(folder) =>
			folder.trim().length > 0
			&& !folder.startsWith("/")
			&& !/[:*?![\]{}\\]/u.test(folder)
			&& !folder.split("/").includes("..")
			&& nonEffectFolderPath(folder) !== "",
		{ message: "Name an explicit repository-relative folder, without parent traversal or glob patterns." },
	),
);

export const NonEffectFolders = Schema.Array(Folder);

export function inNonEffectFolder(file: string, folders: readonly string[]): boolean {
	return folders.some((folder) => file.startsWith(`${nonEffectFolderPath(folder)}/`));
}
