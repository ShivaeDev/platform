import { githubReadRetry } from "#test/githubReadRetry.ts";
import { postgresTests } from "#test/postgres.ts";

for (const failures of [1, 5]) {
	postgresTests("live", "isolated")(`GitHub adoption retries ${failures} failed HTTP reads against the same done worker`, () =>
		githubReadRetry(failures),
	);
}
