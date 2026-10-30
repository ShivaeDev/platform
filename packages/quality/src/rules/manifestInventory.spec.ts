import { expect } from "vitest";
import { CLI_EXIT } from "#test/cli.ts";
import { manifestContains, manifestIsDirectory, manifestStory } from "#test/manifestStory.ts";

for (const content of ['{"name":', '{"dependencies":[]}']) {
	manifestStory.it(
		"reports one broken manifest before dependent rules run",
		[manifestContains("packages/broken/package.json", content)],
		function* ({ lints }) {
			const result = yield* lints();
			expect(result.status).toBe(CLI_EXIT.rejected);
			expect(result.stderr).toBe("");
			expect(result.stdout).toContain("manifests/valid");
			expect(result.stdout).toContain("Invalid package manifest");
			expect(result.stdout.match(/packages\/broken\/package\.json/gu)).toEqual(["packages/broken/package.json"]);
		},
	);
}

manifestStory.it("reports an unreadable manifest instead of treating it as absent", [manifestIsDirectory], function* ({ lints }) {
	const result = yield* lints();
	expect(result.status).toBe(CLI_EXIT.invalid);
	expect(result.stderr).toContain("cannot read");
	expect(result.stderr).toContain("package.json");
});

manifestStory.it(
	"shares one decoded manifest across concurrent consumers",
	[manifestContains("package.json", '{"name":"app"}')],
	function* ({ readsConcurrently }) {
		const { manifests, reads } = yield* readsConcurrently("package.json");
		expect(reads).toEqual(["package.json"]);
		expect(manifests).toEqual([{ name: "app" }, { name: "app" }]);
		expect(manifests[0]).toBe(manifests[1]);
	},
);
