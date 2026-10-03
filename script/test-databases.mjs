import { assertLocalDatabase, localServer } from "./local-postgres.mjs";

export function testDatabases(env = process.env) {
	const base = assertLocalDatabase(env.TEST_DATABASE_URL ?? `${localServer}/platform_test`, ["platform_test"]);
	return Object.fromEntries(
		["PRISMA", "SQL", "PG_BOSS", "CHANGES_PRISMA"].map((name) => {
			const key = `PLATFORM_EFFECT_${name}_TEST_DATABASE_URL`;
			const database = `platform_test_effect_${name.toLowerCase()}`;
			const url = new URL(base);
			url.pathname = `/${database}`;
			const value = env[key] ?? url.toString();
			assertLocalDatabase(value, [database]);
			return [key, value];
		}),
	);
}
