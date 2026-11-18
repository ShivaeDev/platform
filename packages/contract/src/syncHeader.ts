import { Option, Schema } from "effect";
import type { Headers } from "effect/http";
import { SyncToken } from "@shivaedev/changes/syncToken.ts";

const HEADER = "x-shivaedev-sync";
const decodeToken = Schema.decodeUnknownOption(SyncToken);

export function streamSyncHeaders(client: string): Record<string, string> {
	return { [HEADER]: client };
}

export function commandSyncHeaders(token: SyncToken): Record<string, string> {
	return { [HEADER]: `${token.client}:${token.id}` };
}

// A live stream names only its client; the id 1 stands in so one schema validates both header forms.
export function syncClient(headers: Headers.Headers): string | undefined {
	const value = headers[HEADER];
	return value === undefined ? undefined : Option.getOrUndefined(Option.map(decodeToken({ client: value, id: 1 }), (token) => token.client));
}

export function syncToken(headers: Headers.Headers): SyncToken | undefined {
	const [client, id, ...rest] = headers[HEADER]?.split(":") ?? [];
	return rest.length > 0 || id === undefined || !/^[1-9]\d{0,15}$/u.test(id)
		? undefined
		: Option.getOrUndefined(decodeToken({ client, id: Number(id) }));
}
