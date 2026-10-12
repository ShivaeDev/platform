import type { BrowserClient } from "#client/client.ts";
export interface ShellApi {
	readonly board: Pick<BrowserClient["api"]["board"], "query">;
	readonly document: Pick<BrowserClient["api"]["document"], "query">;
	readonly inbox: Pick<BrowserClient["api"]["inbox"], "query">;
	readonly navigation: Pick<BrowserClient["api"]["navigation"], "query">;
	readonly overview: Pick<BrowserClient["api"]["overview"], "query">;
	readonly page: Pick<BrowserClient["api"]["page"], "query">;
	readonly work: Pick<BrowserClient["api"]["work"], "query">;
}
