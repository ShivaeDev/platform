import type { Account } from "./requests.ts";

export type ForgedBearer = "missing" | "unsigned" | "prefixed" | "tampered" | "malformed" | "invented";

export interface Caller {
	readonly bearer?: string;
	readonly cookie?: string;
	readonly cookieValueAsBearer?: string;
	readonly forged?: readonly [ForgedBearer, string];
	readonly origin?: string;
	readonly tokenAsBearer?: string;
}

function forgedAuthorization(kind: ForgedBearer, credential: string) {
	const [payload = ""] = credential.split(".");
	return {
		invented: "Bearer invalid.signature",
		malformed: "Bearer %broken",
		missing: "",
		prefixed: `Bearer x${credential}`,
		tampered: `Bearer ${payload}.tampered`,
		unsigned: `Bearer ${payload}`,
	}[kind];
}

export function callers(accounts: ReadonlyMap<string, Account>) {
	function account(name: string) {
		const value = accounts.get(name);
		if (value === undefined) {
			throw new Error(`No account named ${name}`);
		}
		return value;
	}
	function headersOf(caller: Caller): Record<string, string> {
		const headers: Record<string, string> = {};
		if (caller.origin !== undefined) {
			headers.origin = caller.origin;
		}
		if (caller.bearer !== undefined) {
			headers.authorization = `Bearer ${account(caller.bearer).credential}`;
		}
		if (caller.forged !== undefined) {
			headers.authorization = forgedAuthorization(caller.forged[0], account(caller.forged[1]).credential ?? "");
		}
		if (caller.tokenAsBearer !== undefined) {
			headers.authorization = `Bearer ${account(caller.tokenAsBearer).token}`;
		}
		if (caller.cookieValueAsBearer !== undefined) {
			headers.authorization = `Bearer ${account(caller.cookieValueAsBearer).cookie.split("=")[1]}`;
		}
		if (caller.cookie !== undefined) {
			headers.cookie = account(caller.cookie).cookie;
		}
		return headers;
	}
	function nameOf(id: unknown) {
		return [...accounts].find(([, value]) => value.user.id === id)?.[0];
	}
	function callerWords(caller: Caller) {
		return Object.entries(caller)
			.map(([key, value]) => `${key} ${String(value)}`)
			.join(", ");
	}
	return { account, callerWords, headersOf, nameOf };
}
