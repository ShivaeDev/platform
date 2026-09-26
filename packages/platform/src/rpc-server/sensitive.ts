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

const wordsOf = (key: string): Array<string> =>
	key
		.replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replaceAll(/([A-Z])([A-Z][a-z])/g, "$1 $2")
		.toLowerCase()
		.split(/[\s_-]+/);

export const isSensitiveKey: SensitiveKey = (key) => {
	const normalized = key.toLowerCase().replaceAll(/[-_]/g, "");
	return (
		SENSITIVE_NAMES.includes(normalized) ||
		SENSITIVE_PARTS.some((part) => normalized.includes(part)) ||
		wordsOf(key).some((word) => SENSITIVE_WORDS.includes(word))
	);
};

const AUTH_SCHEME = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
const URL_PASSWORD = /(\/\/[^:/\s@]+:)[^@/\s]+@/g;
const ASSIGNMENT = /([A-Za-z][\w.-]*)(["']?\s*[=:]\s*["']?)([^\s"'&,;]+)/g;

const scrub = (text: string, sensitive: SensitiveKey): string =>
	text
		.replaceAll(AUTH_SCHEME, `$1 ${REDACTED}`)
		.replaceAll(JWT, REDACTED)
		.replaceAll(URL_PASSWORD, `$1${REDACTED}@`)
		.replaceAll(ASSIGNMENT, (match: string, key: string, separator: string) => (sensitive(key) ? `${key}${separator}${REDACTED}` : match));

export const redactText = (text: string, sensitive: SensitiveKey): string => {
	const scrubbed = scrub(text, sensitive);
	return scrubbed.length > MAX_STRING ? `${scrubbed.slice(0, MAX_STRING)}…<${scrubbed.length - MAX_STRING} more chars>` : scrubbed;
};
