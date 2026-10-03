import { readFileSync } from "node:fs";
import { assertLocalDatabase, localServer, prepareDatabases, sql } from "./local-postgres.mjs";

if (process.env.NODE_ENV === "production") throw new Error("Local setup must not run in production.");

const development = process.env.DATABASE_URL ?? `${localServer}/platform_dev`;
const test = process.env.TEST_DATABASE_URL ?? `${localServer}/platform_test`;
assertLocalDatabase(development, ["platform_dev"]);
assertLocalDatabase(test, ["platform_test"]);
prepareDatabases([development, test]);
for (const schema of ["packages/effect-prisma/test/schema.sql", "packages/platform/test/auth/schema.sql"]) {
	const source = readFileSync(schema, "utf8")
		.replaceAll("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ")
		.replaceAll("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ");
	sql(test, source);
}
console.log("Local development and integration databases are ready.");
