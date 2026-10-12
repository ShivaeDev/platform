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
const SENSITIVE_NAMES = ["session", "pan"];
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
const URL_PASSWORD = /(?<authority>\/\/[^:/\s@]+:)[^@/\s]+@/gu;
const ASSIGNMENT = /(?<key>[A-Za-z][\w.-]*)(?<separator>["']?\s*[=:]\s*["']?)(?<value>[^\s"'&,;]+)/gu;
function scrub(text: string, sensitive: SensitiveKey): string {
	return text
		.replaceAll(AUTH_SCHEME, `$<scheme> ${REDACTED}`)
		.replaceAll(JWT, REDACTED)
		.replaceAll(URL_PASSWORD, `$<authority>${REDACTED}@`)
		.replaceAll(ASSIGNMENT, (match: string, key: string, separator: string) => (sensitive(key) ? `${key}${separator}${REDACTED}` : match));
}
export function redactText(text: string, sensitive: SensitiveKey): string {
	const scrubbed = scrub(text, sensitive);
	return scrubbed.length > MAX_STRING ? `${scrubbed.slice(0, MAX_STRING)}…<${scrubbed.length - MAX_STRING} more chars>` : scrubbed;
}
