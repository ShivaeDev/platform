import type { BrowserClient } from "#client/client.ts";
export interface ShellApi {
	readonly document: Pick<BrowserClient["api"]["document"], "query">;
	readonly navigation: Pick<BrowserClient["api"]["navigation"], "query">;
	readonly page: Pick<BrowserClient["api"]["page"], "query">;
}
