import { isSensitiveKey, REDACTED, redactText, type SensitiveKey } from "#sensitive.ts";

export function redactBrowserText(text: string, sensitive: SensitiveKey = isSensitiveKey): string {
	const masked = text.replaceAll(/(?<quote>["`]|(?<![\p{L}\p{N}_])')(?:\\[\s\S]|(?!\k<quote>)[^\\])*\k<quote>/gu, `$<quote>${REDACTED}$<quote>`);
	return redactText(masked, sensitive);
}
