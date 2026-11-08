import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app } from "#starter-published/test-support/app.ts";
import { failingCi, workerWarning } from "#starter-published/test-support/installerTraits.ts";
import { unpublishedContract } from "#starter-published/test-support/unpublishedContract.ts";

app.it(
	"runs the installed app's own CI script with its working directory and PostgreSQL URL",
	[unpublishedContract],
	function* ({ run, ciResult, directory, database }) {
		yield* outcomes([
			["run", () => run(), undefined],
			["CI result", () => Effect.map(ciResult(), (text) => JSON.parse(text)), { cwd: directory, database, query: 42 }],
		]);
	},
);

app.it("fails the published-starter check when the installed app's CI script fails", [unpublishedContract, failingCi], function* ({ run }) {
	expect(yield* run()).toContain("Generated app: pnpm run ci failed (exit 1)");
});

for (const stream of ["stdout", "stderr"] as const) {
	app.it(
		`fails and names the affected files when a successful app CI script warns on ${stream}`,
		[unpublishedContract, workerWarning(stream)],
		function* ({ run }) {
			expect(yield* run()).toContain(
				"Vitest workers did not exit cleanly:\n[vitest-pool]: Timeout terminating forks worker for test files src/first.spec.ts, src/second.dom.spec.ts.",
			);
		},
	);
}
