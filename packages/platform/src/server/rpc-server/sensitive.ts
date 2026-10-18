export const REDACTED = "<redacted>";
const MAX_STRING = 2048;
const SENSITIVE_PARTS = [
	"password",
	"passphrase",
	"secret",
	"token",
	"authorization",
	"cookie",
	"apikey",
	"accesskey",
	"credential",
	"privatekey",
	"jwt",
	"bearer",
	"signature",
	"sessionid",
	"cardnumber",
	"accountnumber",
	"csrf",
	"xsrf",
];
const SENSITIVE_WORDS = ["otp", "pin", "cvv", "cvc", "ssn", "iban"];
const SENSITIVE_NAMES = ["session", "pan", "sig"];
export type SensitiveKey = (key: string) => boolean;
function wordsOf(key: string): string[] {
	return key
		.replaceAll(/(?<lower>[a-z0-9])(?<upper>[A-Z])/gu, "$<lower> $<upper>")
		.replaceAll(/(?<initial>[A-Z])(?<word>[A-Z][a-z])/gu, "$<initial> $<word>")
		.toLowerCase()
		.split(/[\s_-]+/u);
}
export function isSensitiveKey(key: string): boolean {
	const normalized = key.toLowerCase().replaceAll(/[-_]/gu, "");
	return (
		SENSITIVE_NAMES.includes(normalized)
		|| SENSITIVE_PARTS.some((part) => normalized.includes(part))
		|| wordsOf(key).some((word) => SENSITIVE_WORDS.includes(word))
	);
}
const AUTH_SCHEME = /\b(?<scheme>Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/giu;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/gu;
const PRIVATE_KEY = /-----BEGIN (?<kind>(?:[A-Z0-9]+ )*PRIVATE KEY)-----[\s\S]*?-----END \k<kind>-----/gu;
const URL_PASSWORD = /(?<authority>\/\/[^:/\s@]+:)[^@/\s]+@/gu;
function redactAssignments(text: string, sensitive: SensitiveKey): string {
	const matcher = /(?<key>[A-Za-z][\w.-]*)(?<separator>["']?\s*[=:]\s*["']?)(?<value>[^\s"'&,;]+)/gu;
	let result = "";
	let cursor = 0;
	for (let match = matcher.exec(text); match !== null; match = matcher.exec(text)) {
		const key = match[1] ?? "";
		const separator = match[2] ?? "";
		if (sensitive(key)) {
			result += `${text.slice(cursor, match.index)}${key}${separator}${REDACTED}`;
			cursor = matcher.lastIndex;
		} else if (match[3]?.includes("=")) {
			// Revisit embedded parameters without parsing URL and source-location colons as assignments.
			matcher.lastIndex = match.index + key.length + separator.length;
		}
	}
	return result + text.slice(cursor);
}
function scrub(text: string, sensitive: SensitiveKey): string {
	const credentials = text
		.replaceAll(PRIVATE_KEY, REDACTED)
		.replaceAll(AUTH_SCHEME, `$<scheme> ${REDACTED}`)
		.replaceAll(JWT, REDACTED)
		.replaceAll(URL_PASSWORD, `$<authority>${REDACTED}@`);
	return redactAssignments(credentials, sensitive);
}
export function redactText(text: string, sensitive: SensitiveKey): string {
	const scrubbed = scrub(text, sensitive);
	return scrubbed.length > MAX_STRING ? `${scrubbed.slice(0, MAX_STRING)}…<${scrubbed.length - MAX_STRING} more chars>` : scrubbed;
}
