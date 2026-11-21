const SAFELISTED = new Set(["accept", "accept-language", "content-language", "origin"]);
const SIMPLE_CONTENT_TYPES = new Set(["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"]);

export interface ShellPreflight {
	readonly granted: boolean;
	readonly path: string;
	readonly requested: readonly string[];
}

function preflightedHeaders(headers: Headers) {
	return [...headers]
		.filter(([name, value]) => !(SAFELISTED.has(name) || (name === "content-type" && SIMPLE_CONTENT_TYPES.has(value.split(";")[0]?.trim() ?? ""))))
		.map(([name]) => name)
		.sort((left, right) => left.localeCompare(right));
}

export async function preflightGrants(url: string, origin: string, method: string, requested: readonly string[]) {
	const answer = await fetch(url, {
		headers: { "access-control-request-headers": requested.join(", "), "access-control-request-method": method, origin },
		method: "OPTIONS",
	});
	const allowed = (answer.headers.get("access-control-allow-headers") ?? "").split(",").map((name) => name.trim().toLowerCase());
	return answer.ok && answer.headers.get("access-control-allow-origin") === origin && requested.every((name) => allowed.includes(name.toLowerCase()));
}

// A bundled page calls the host cross-origin, so the WebView clears each request that carries a header outside the
// CORS safelist with a preflight first, and refuses the request when the answer does not allow every such header.
export async function webViewPreflight(preflights: ShellPreflight[], origin: string, url: string, init?: RequestInit) {
	const requested = preflightedHeaders(new Headers(init?.headers));
	if (requested.length === 0) {
		return;
	}
	const granted = await preflightGrants(url, origin, init?.method ?? "GET", requested);
	preflights.push({ granted, path: new URL(url).pathname, requested });
	if (!granted) {
		throw new TypeError(`The WebView's preflight for ${url} was refused`);
	}
}
