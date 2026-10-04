const WORD = /[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/gu;

export const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const CAMEL = /^[a-z][a-zA-Z0-9]*$/u;

export const PASCAL = /^[A-Z][a-zA-Z0-9]*$/u;

export function wordsOf(name: string): readonly string[] {
	return [...name.matchAll(WORD)].map((match) => match[0].toLowerCase());
}

export function singular(word: string): string {
	if (word.endsWith("ies") && word.length > 3) {
		return `${word.slice(0, -3)}y`;
	}
	return word.endsWith("s") && !word.endsWith("ss") && word.length > 1 ? word.slice(0, -1) : word;
}

export function sameWord(left: string, right: string): boolean {
	return singular(left) === singular(right);
}

export function isUpper(text: string): boolean {
	return /^[A-Z]/u.test(text);
}
