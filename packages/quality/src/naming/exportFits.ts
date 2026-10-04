import { CAMEL, isUpper, PASCAL, sameWord, wordsOf } from "#naming/words.ts";

function restIsFolders(rest: readonly string[], folders: readonly string[]): boolean {
	const folderWords = folders.flatMap(wordsOf);
	return rest.every((word) => folderWords.some((folder) => sameWord(word, folder)));
}

export function exportFits(name: string, stem: string, folders: readonly string[]): boolean {
	if (!(CAMEL.test(stem) || PASCAL.test(stem)) || isUpper(stem) !== isUpper(name)) {
		return false;
	}
	const named = wordsOf(name);
	const filed = wordsOf(stem);
	for (let start = 0; start + filed.length <= named.length; start += 1) {
		const matches = filed.every((word, offset) => word === named[start + offset]);
		if (matches && restIsFolders([...named.slice(0, start), ...named.slice(start + filed.length)], folders)) {
			return true;
		}
	}
	return false;
}
