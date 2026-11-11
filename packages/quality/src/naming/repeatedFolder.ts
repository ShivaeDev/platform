import { sameWord, wordsOf } from "#naming/words.ts";

function letters(name: string): string {
	return name.replace(/[^a-z0-9]/giu, "").toLowerCase();
}

export function repeatedFolder(stem: string, folders: readonly string[]): string | undefined {
	const own = folders.at(-1);
	if (own !== undefined && letters(own) === letters(stem)) {
		return undefined;
	}
	const words = wordsOf(stem);
	return folders.find((folder) => wordsOf(folder).some((word) => words.some((stemWord) => sameWord(stemWord, word))));
}
