import { Option, Schema } from "effect";
import { privateKeyBlocks } from "#privateKeyBlocks.ts";
import { sensitiveAssignmentValues } from "#sensitiveAssignmentValues.ts";

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
const PREFIXED_TOKEN =
	/\b(?:gh[oprsu]_[A-Za-z0-9]{36,}|github_pat_\w{22,}|[rs]k_(?:live|test)_[A-Za-z0-9]{24,}|A[KS]IA[0-9A-Z]{16}\b|xox[abps]-[A-Za-z0-9-]{10,})/gu;
// Schemes other than Bearer and Basic, such as `token` or `Digest`, are only recognisable after the header name.
const AUTHORIZATION_HEADER = /\b(?<header>(?:proxy-)?authorization:[ \t]*[A-Za-z][\w-]*[ \t]+)[^\s"',;]+/giu;
function mask(text: string, ranges: ReadonlyArray<readonly [number, number]>): string {
	let result = "";
	let cursor = 0;
	for (const [start, end] of ranges) {
		result += `${text.slice(cursor, start)}${REDACTED}`;
		cursor = end;
	}
	return result + text.slice(cursor);
}
function scrub(text: string, sensitive: SensitiveKey): string {
	const credentials = mask(text, privateKeyBlocks(text))
		.replaceAll(AUTH_SCHEME, `$<scheme> ${REDACTED}`)
		.replaceAll(AUTHORIZATION_HEADER, `$<header>${REDACTED}`)
		.replaceAll(JWT, REDACTED)
		.replaceAll(PREFIXED_TOKEN, REDACTED);
	return mask(credentials, sensitiveAssignmentValues(credentials, sensitive));
}
function redactSchemaValues(text: string): string {
	return text
		.replaceAll(
			/(?<expected>\bExpected(?:(?!\bExpected\b)[^\r\n])*?, (?:got|actual)[ \t]+)(?:"(?:\\[\s\S]|[^"\\])*"|[^\r\n]*)/gu,
			`$<expected>${REDACTED}`,
		)
		.replaceAll(/\bgot[ \t]+"(?:\\[\s\S]|[^"\\])*"/gu, `got ${REDACTED}`);
}
export function redactText(text: string, sensitive: SensitiveKey, maxLength = MAX_STRING, key = ""): string {
	const scrubbed = scrub(redactUrl(redactSchemaValues(text), key), sensitive);
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
			/(?<authority>(?:(?<![a-z0-9+.-])[a-z][a-z0-9+.-]*:)?\/\/)[^/?#]*@/giu,
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
	return value.replaceAll(/(?:(?<![a-z0-9+.-])[a-z][a-z0-9+.-]*:\/\/|[/?#]).*/gisu, url);
}
