import { REDACTED } from "#server/rpc-server/sensitive.ts";

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

function structured(value: string): string | undefined {
	try {
		return JSON.stringify(JSON.parse(value, (key: string, item: unknown) => (typeof item === "string" ? redactOtlpUrl(item, key) : item)));
	} catch {
		return undefined;
	}
}

export function redactOtlpUrl(value: string, key = ""): string {
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
