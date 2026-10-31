import { Option, Schema } from "effect";

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
const SENSITIVE_NAMES = ["session", "pan", "sig", "db.user", "db.user.name", "db.connectionstring"];
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
const AUTH_SCHEME = /\b(?<scheme>Bearer|Basic)\s+[A-Za-z0-9%._~+/-]+=*/giu;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/gu;
const PRIVATE_KEY = /-----BEGIN (?<kind>(?:[A-Z0-9]+ )*PRIVATE KEY)-----[\s\S]*?-----END \k<kind>-----/gu;
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
	const credentials = text.replaceAll(PRIVATE_KEY, REDACTED).replaceAll(AUTH_SCHEME, `$<scheme> ${REDACTED}`).replaceAll(JWT, REDACTED);
	return redactAssignments(credentials, sensitive);
}
export function redactText(text: string, sensitive: SensitiveKey, maxLength = MAX_STRING, key = ""): string {
	const scrubbed = scrub(redactUrl(text, key), sensitive);
	return scrubbed.length > maxLength ? `${scrubbed.slice(0, maxLength)}…<${scrubbed.length - maxLength} more chars>` : scrubbed;
}
export function redactErrorStack(error: Error, sensitive: SensitiveKey): string | undefined {
	if (error.stack === undefined) {
		return undefined;
	}
	return ["message", "name", "stack"].some((key) => sensitive(key)) ? REDACTED : redactText(error.stack, sensitive);
}

function query(value: string): string {
	return value
		.split("&")
		.map((part) => (part === "" ? part : `${part.split("=", 1)[0]}=${REDACTED}`))
		.join("&");
}

function url(value: string): string {
	const fragment = value.indexOf("#");
	const target = fragment === -1 ? value : value.slice(0, fragment);
	const separator = target.indexOf("?");
	return (
		(separator === -1 ? target : `${target.slice(0, separator + 1)}${query(target.slice(separator + 1))}`).replaceAll(
			/(?<authority>(?:\b[a-z][a-z0-9+.-]*:)?\/\/)[^/?#]*@/giu,
			`$<authority>${REDACTED}@`,
		) + (fragment === -1 ? "" : `#${REDACTED}`)
	);
}

const structuredUrl = Schema.decodeUnknownOption(
	Schema.fromJsonString(Schema.Unknown, {
		reviver: (key: string, item: unknown) => (typeof item === "string" ? redactUrl(item, key) : item),
	}),
);
function structured(value: string): string | undefined {
	return Option.getOrUndefined(Option.map(structuredUrl(value), (parsed) => JSON.stringify(parsed)));
}

export function redactUrl(value: string, key = ""): string {
	if (/(?:^|[._-])(?:fragment|userinfo|username|password)$/iu.test(key)) {
		return REDACTED;
	}
	if (/(?:^|[._-])query$/iu.test(key)) {
		return url(`?${value}`).slice(1);
	}
	if (/(?:^|[._-])(?:url|uri|target)(?:$|[._-])/iu.test(key) || /(?:^|[._-])(?:referer|referrer|location|origin)$/iu.test(key)) {
		return url(value);
	}
	if (/^\s*[[{]/u.test(value)) {
		const redacted = structured(value);
		if (redacted !== undefined) {
			return redacted;
		}
	}
	// Quotes and whitespace can belong to secret values, so free text has no safe closing delimiter.
	return value.replaceAll(/(?:[a-z][a-z0-9+.-]*:\/\/|[/?#]).*/gisu, url);
}
