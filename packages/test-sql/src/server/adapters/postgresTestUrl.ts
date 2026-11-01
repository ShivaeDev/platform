import { environmentVariable } from "./environmentVariable.ts";

export function postgresTestUrl(name: string): { readonly url: string | undefined; readonly configured: boolean } {
	const value = environmentVariable(name);
	const url = value === "" ? undefined : value;
	if (url === undefined && (environmentVariable("CI") ?? "") !== "") {
		throw new Error(`CI requires ${name}; skipped PostgreSQL tests prove nothing.`);
	}
	return { configured: url !== undefined, url };
}
