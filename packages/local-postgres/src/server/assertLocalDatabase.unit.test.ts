import { Result } from "effect";
import { expect, it } from "vitest";
import { assertLocalDatabase } from "#server/assertLocalDatabase.ts";

const SERVER = "postgresql://postgres:postgres@127.0.0.1:55432";

it("accepts a local database in the setup script's allowlist", () => {
	const url = Result.getOrThrow(assertLocalDatabase(`${SERVER}/example_test`, ["example_test"]));
	expect(url.pathname).toBe("/example_test");
});

for (const host of ["localhost", "127.0.0.1"]) {
	it(`accepts the CI database on ${host}:5432 when that port is explicitly allowed`, () => {
		const url = Result.getOrThrow(assertLocalDatabase(`postgres://${host}:5432/platform_test`, ["platform_test"], ["55432", "5432"]));
		expect(url.port).toBe("5432");
	});
}

for (const value of [
	"not a database URL",
	"https://localhost:5432/platform_test",
	"postgres://example.com:5432/platform_test",
	"postgres://localhost:5433/platform_test",
	"postgres://localhost:5432/platform_dev",
	...["host", "hostaddr", "port", "dbname", "service"].map((key) => `postgres://localhost:5432/platform_test?${key}=redirected`),
]) {
	it(`refuses an unsafe test destination even when the CI port is allowed: ${value}`, () => {
		const result = Result.getOrThrow(Result.flip(assertLocalDatabase(value, ["platform_test"], ["55432", "5432"])));
		expect(result.message).toBe("Use a local database on 127.0.0.1:55432 or 5432 named platform_test.");
	});
}

for (const url of [
	"postgresql://postgres:postgres@example.com:55432/example_test",
	"postgresql://postgres:postgres@127.0.0.1:5432/example_test",
	...["host", "hostaddr", "port", "dbname", "service"].map((key) => `${SERVER}/example_test?${key}=redirected`),
	`${SERVER}/example_dev`,
]) {
	it(`refuses a database outside the local allowlist: ${url}`, () => {
		const result = Result.getOrThrow(Result.flip(assertLocalDatabase(url, ["example_test"])));
		expect(result.message).toBe("Use a local database on 127.0.0.1:55432 named example_test.");
	});
}
