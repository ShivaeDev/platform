import type { OwnExport } from "#naming/ownExports.ts";
import { CAMEL, sameWord, wordsOf } from "#naming/words.ts";

function sharedWords(constants: readonly OwnExport[]): readonly string[] {
	return wordsOf(constants[0]?.name ?? "").filter((word) => constants.every((entry) => wordsOf(entry.name).some((own) => sameWord(own, word))));
}

function fits(stem: string, constants: readonly OwnExport[]): boolean {
	if (!CAMEL.test(stem)) {
		return false;
	}
	const words = wordsOf(stem);
	return constants.every((entry) => {
		const own = wordsOf(entry.name);
		return stem === "limits"
			? own.some((word) => ["max", "min", "limit"].some((limit) => sameWord(word, limit)))
			: words.every((word) => own.some((constant) => sameWord(word, constant)));
	});
}

export function constantModule(stem: string, constants: readonly OwnExport[]): string | undefined {
	if (fits(stem, constants)) {
		return undefined;
	}
	const candidates = sharedWords(constants);
	const suggestion = candidates.length === 0 ? "" : ` Shared words: ${candidates.join(", ")}.`;
	return `"${stem}" holds only plain-data constants. Name the module in camelCase after a word each constant carries, such as timeouts.ts for INSPECT_TIMEOUT_MILLIS and REMOTE_TIMEOUT_MILLIS, or split it.${suggestion} Put MAX_/MIN_ constants in limits.ts and DEFAULT_ constants in defaults.ts; every constant must fit the name.`;
}
