import type { BrowserClient } from "#client/client.ts";
export interface ShellApi {
	readonly board: Pick<BrowserClient["api"]["board"], "query">;
	readonly diagnostics: Pick<BrowserClient["api"]["diagnostics"], "query">;
	readonly document: Pick<BrowserClient["api"]["document"], "query">;
	readonly fleetItems: Pick<BrowserClient["api"]["fleetItems"], "query">;
	readonly goals: Pick<BrowserClient["api"]["goals"], "query">;
	readonly handoff: Pick<BrowserClient["api"]["handoff"], "query">;
	readonly inbox: Pick<BrowserClient["api"]["inbox"], "query">;
	readonly library: Pick<BrowserClient["api"]["library"], "query">;
	readonly navigation: Pick<BrowserClient["api"]["navigation"], "query">;
	readonly result: Pick<BrowserClient["api"]["result"], "query">;
	readonly search: Pick<BrowserClient["api"]["search"], "query">;
	readonly start: Pick<BrowserClient["api"]["start"], "query">;
	readonly work: Pick<BrowserClient["api"]["work"], "query">;
}
