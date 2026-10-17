export interface ParsedResponse {
	readonly body: string;
	readonly headers: ReadonlyMap<string, string>;
	readonly status: number;
}

export function parseResponse(output: string): ParsedResponse | undefined {
	const split = /\r?\n\r?\n/u.exec(output);
	const head = split === null ? output : output.slice(0, split.index);
	const [statusLine = "", ...lines] = head.split(/\r?\n/u);
	const status = Number(/^HTTP\/\S+ (?<status>\d{3})/u.exec(statusLine)?.groups?.status);
	if (!Number.isInteger(status)) {
		return undefined;
	}
	const headers = new Map<string, string>();
	for (const line of lines) {
		const colon = line.indexOf(":");
		if (colon > 0) {
			headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
		}
	}
	return { body: split === null ? "" : output.slice(split.index + split[0].length), headers, status };
}

export function headerCount(headers: ReadonlyMap<string, string>, name: string) {
	const value = headers.get(name);
	return value !== undefined && /^\d+$/u.test(value) ? Number(value) : undefined;
}

export function nextLink(headers: ReadonlyMap<string, string>) {
	return /<(?<url>[^>]+)>;\s*rel="next"/u.exec(headers.get("link") ?? "")?.groups?.url;
}

export function requestResource(endpoint: string) {
	const path = endpoint.replace(/^https:\/\/api\.github\.com\//u, "");
	return path.startsWith("search/") ? "search" : "core";
}
