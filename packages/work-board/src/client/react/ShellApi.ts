import type { BrowserClient } from "#client/client.ts";
export interface ShellApi {
	readonly navigation: Pick<BrowserClient["api"]["navigation"], "query">;
	readonly page: Pick<BrowserClient["api"]["page"], "query">;
}
