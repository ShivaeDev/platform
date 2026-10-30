import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { postgres } from "#test/postgres.ts";

const SERVER = "postgresql://postgres:postgres@127.0.0.1:55432";
const REFUSED_TARGETS = [
	["a remote host", "postgresql://postgres:postgres@example.com:55432/example_test"],
	["port 5432", "postgresql://postgres:postgres@127.0.0.1:5432/example_test"],
	...["host", "hostaddr", "port", "dbname", "service"].map(
		(key) => [`a redirecting ${key} parameter`, `${SERVER}/example_test?${key}=redirected`] as const,
	),
] as const;

postgres.it("the setup script's allowlist accepts its local database", [], function* ({ allowDatabase, outcome }) {
	yield* allowDatabase(`${SERVER}/example_test`, ["example_test"]);

	expect(yield* outcome()).toBe("allowed example_test");
});

for (const [target, url] of [...REFUSED_TARGETS, ["a database outside the allowlist", `${SERVER}/example_dev`]] as const) {
	postgres.it(`the setup script's allowlist refuses ${target}`, [], function* ({ allowDatabase, outcome }) {
		yield* allowDatabase(url, ["example_test"]);

		expect(yield* outcome()).toBe("failed: Use a local database on 127.0.0.1:55432 named example_test.");
	});
}

for (const [target, url] of REFUSED_TARGETS) {
	postgres.it(`preparing a database at ${target} is refused before any command runs`, [], function* ({ outcome, prepare, subprocesses }) {
		yield* prepare([url]);

		yield* outcomes({
			"commands": [subprocesses(), []],
			"setup": [outcome(), "failed: Use a local database on 127.0.0.1:55432 named example_test."],
		});
	});

	postgres.it(
		`preparing a local database together with one at ${target} is refused before any command runs`,
		[],
		function* ({ outcome, prepare, subprocesses }) {
			yield* prepare([`${SERVER}/example_dev`, url]);

			yield* outcomes({
				"commands": [subprocesses(), []],
				"setup": [outcome(), "failed: Use a local database on 127.0.0.1:55432 named example_test."],
			});
		},
	);

	postgres.it(`starting PostgreSQL through ${target} is refused before any command runs`, [], function* ({ outcome, start, subprocesses }) {
		yield* start(url);

		yield* outcomes({
			"commands": [subprocesses(), []],
			"setup": [outcome(), "failed: Use a local database on 127.0.0.1:55432 named postgres."],
		});
	});

	postgres.it(`a query to ${target} is refused before any command runs`, [], function* ({ outcome, query, subprocesses }) {
		yield* query("SELECT 1", url);

		yield* outcomes({
			"commands": [subprocesses(), []],
			"query": [outcome(), "failed: Use a local database on 127.0.0.1:55432 named example_test."],
		});
	});
}

for (const name of ["", "1starts_with_number", "has-hyphens", "Uppercase", "a".repeat(64), "name%27%3Bselect"]) {
	postgres.it(
		`preparing a database named ${JSON.stringify(name)} is refused as an invalid name before any command runs`,
		[],
		function* ({ outcome, prepare, subprocesses }) {
			yield* prepare([`${SERVER}/${name}`]);

			yield* outcomes({
				"commands": [subprocesses(), []],
				"setup": [outcome(), "failed: Invalid local database name."],
			});
		},
	);
}
