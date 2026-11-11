import { LOCAL_SERVER } from "@shivaedev/local-postgres/server/localPostgres.ts";
import { environmentVariable } from "#server/adapters/environmentVariable.ts";

const PREFIX = "PLATFORM_";
const SUFFIX = "_TEST_DATABASE_URL";

function localDatabase(name: string): string | undefined {
	if (!(name.startsWith(PREFIX) && name.endsWith(SUFFIX))) {
		return undefined;
	}
	const middle = name.slice(PREFIX.length, name.length - SUFFIX.length);
	return /^[A-Z][A-Z_]*$/u.test(middle) ? `${LOCAL_SERVER}/platform_test_${middle.toLowerCase()}` : undefined;
}

export function postgresTestUrl(name: string): { readonly url: string | undefined; readonly configured: boolean } {
	const value = environmentVariable(name);
	const given = value === "" ? undefined : value;
	if (given === undefined && (environmentVariable("CI") ?? "") !== "") {
		throw new Error(`CI requires ${name}; skipped PostgreSQL tests prove nothing.`);
	}
	const url = given ?? localDatabase(name);
	return { configured: url !== undefined, url };
}
