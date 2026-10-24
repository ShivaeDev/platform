import { expect } from "@effect/vitest";
import type { ReleasePlan } from "#model.ts";
import { CORE } from "#test/fixture.ts";
import { pending, workspace } from "#test/workspace.ts";

workspace.it(
	"the highest bump wins and all published dependents release transitively",
	[pending({ [CORE]: "patch", "@test/api": "minor" })],
	function* ({ change, cli, packageVersion }) {
		yield* change("breaking", { [CORE]: "minor" }, "### Breaking\n\n- A deliberate breaking change.\n");
		const result = yield* cli("plan", "--json");
		expect(result.status).toBe(0);
		const plan: ReleasePlan = JSON.parse(result.stdout);
		expect(plan.releases).toEqual([
			{ bump: "minor", directory: "packages/api", from: "0.5.0", name: "@test/api", to: "0.6.0" },
			{ bump: "minor", directory: "packages/core", from: "0.2.3", name: CORE, to: "0.3.0" },
			{ bump: "patch", directory: "packages/optional", from: "1.0.0", name: "@test/optional", to: "1.0.1" },
			{ bump: "patch", directory: "packages/peer", from: "1.0.0", name: "@test/peer", to: "1.0.1" },
		]);
		expect(plan.changesets.map((source) => source.name)).toEqual(["breaking.md", "feature.md"]);
		expect((yield* cli("plan")).stdout).toContain(`${CORE}: 0.2.3 -> 0.3.0 (minor)`);
		expect(yield* packageVersion("packages/core")).toBe("0.2.3");
	},
);
workspace.it("major releases are explicit after 1.0", [pending({ "@test/optional": "major" })], function* ({ cli }) {
	const result = yield* cli("plan");
	expect(result.status).toBe(0);
	expect(result.stdout).toContain("@test/optional: 1.0.0 -> 2.0.0 (major)");
	expect(result.stdout).toContain("@test/peer: 1.0.0 -> 1.0.1 (patch)");
});
workspace.it("an empty workspace release is a no-op", [], function* ({ cli, exists }) {
	expect((yield* cli("plan")).stdout.trim()).toBe("No pending releases.");
	expect((yield* cli("apply")).stdout.trim()).toBe("No pending releases.");
	expect(yield* exists(".changeset/release.json")).toBe(false);
	expect((yield* cli("check")).status).toBe(0);
});
