import { Effect } from "effect";
import { expect, it } from "vitest";
import { assertLocalDatabase } from "#assertLocalDatabase.ts";

const SERVER = "postgresql://postgres:postgres@127.0.0.1:55432";

it("accepts a local database in the setup script's allowlist", () => {
	const url = Effect.runSync(assertLocalDatabase(`${SERVER}/example_test`, ["example_test"]));
	expect(url.pathname).toBe("/example_test");
});

for (const url of [
	"postgresql://postgres:postgres@example.com:55432/example_test",
	"postgresql://postgres:postgres@127.0.0.1:5432/example_test",
	...["host", "hostaddr", "port", "dbname", "service"].map((key) => `${SERVER}/example_test?${key}=redirected`),
	`${SERVER}/example_dev`,
]) {
	it(`refuses a database outside the local allowlist: ${url}`, () => {
		const result = Effect.runSync(Effect.flip(assertLocalDatabase(url, ["example_test"])));
		expect(result.message).toBe("Use a local database on 127.0.0.1:55432 named example_test.");
	});
}
