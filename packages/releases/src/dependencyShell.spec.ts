import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { dependencyShell, PACKAGE_JSON_ONLY, SHELL } from "#test/dependencyShell.ts";
import { CORE, FEATURE_NOTE, RELEASED_HISTORY } from "#test/fixture.ts";
import { changeset, released } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

const CORE_BREAKING = "### Breaking\n\n- Rename `start` to `run`.\n";
const BOTH_BREAKING = [
	"### Breaking",
	"",
	"- `@test/core`: Rename `start` to `run`.",
	"  Call `run()` where you called `start()`.",
	"- `@test/api`: Remove `legacyRoute`; use `route`.",
	"",
].join("\n");

workspace.it(
	`plan gives ${SHELL}, which exports only ./package.json, a minor when ${CORE} releases a Breaking entry, while its other dependents keep a patch`,
	[dependencyShell(), changeset("breaking", { [CORE]: "minor" }, CORE_BREAKING)],
	function* ({ plan }) {
		expect(yield* plan()).toEqual([
			"@test/api: 0.5.0 -> 0.5.1 (patch)",
			`${CORE}: 0.2.3 -> 0.3.0 (minor)`,
			"@test/optional: 1.0.0 -> 1.0.1 (patch)",
			"@test/peer: 1.0.0 -> 1.0.1 (patch)",
			`${SHELL}: 0.4.0 -> 0.5.0 (minor)`,
		]);
	},
);

for (const { body, description, exports } of [
	{ body: FEATURE_NOTE, description: `${CORE} releases only an Added entry`, exports: PACKAGE_JSON_ONLY },
	{ body: CORE_BREAKING, description: "it also exports ./*.ts", exports: { "./*.ts": "./src/*.ts", ...PACKAGE_JSON_ONLY } },
]) {
	workspace.it(
		`plan patches ${SHELL} when ${description}`,
		[dependencyShell(exports), changeset("core", { [CORE]: "minor" }, body)],
		function* ({ plan }) {
			expect(yield* plan()).toContain(`${SHELL}: 0.4.0 -> 0.4.1 (patch)`);
		},
	);
}

workspace.it(
	`plan --json names the dependencies whose Breaking entries ${SHELL} carries, and none for a library dependent`,
	[dependencyShell(), changeset("breaking", { [CORE]: "minor" }, CORE_BREAKING)],
	function* ({ planJson }) {
		const plan = yield* planJson();
		function release(name: string) {
			return typeof plan === "string" ? plan : plan.releases.find((candidate) => candidate.name === name);
		}

		expect(release(SHELL)).toEqual({
			breakingDependencies: [CORE],
			bump: "minor",
			directory: "packages/shell",
			from: "0.4.0",
			name: SHELL,
			to: "0.5.0",
		});
		expect(release("@test/api")).toEqual({ bump: "patch", directory: "packages/api", from: "0.5.0", name: "@test/api", to: "0.5.1" });
	},
);

workspace.it(
	`apply writes ${SHELL}'s Update lines and repeats each Breaking bullet of its dependencies under its own Breaking, naming their package`,
	[dependencyShell(), changeset("breaking", { "@test/api": "minor", [CORE]: "minor" }, BOTH_BREAKING)],
	function* ({ apply, changelog, todayInUtc }) {
		yield* apply();

		expect(yield* changelog(SHELL)).toBe(
			[
				"# Changelog",
				"",
				`## 0.5.0 - ${yield* todayInUtc()}`,
				"",
				"### Changed",
				"",
				"- Update `@test/api` from 0.5.0 to 0.6.0.",
				`- Update \`${CORE}\` from 0.2.3 to 0.3.0.`,
				"",
				"### Breaking",
				"",
				`- \`${CORE}\`: Rename \`start\` to \`run\`.`,
				"  Call `run()` where you called `start()`.",
				"- `@test/api`: Remove `legacyRoute`; use `route`.",
				"",
				RELEASED_HISTORY,
			].join("\n"),
		);
	},
);

workspace.it(
	`check accepts the applied release of ${SHELL} at its minor with the repeated Breaking notes`,
	[dependencyShell(), changeset("breaking", { [CORE]: "minor" }, CORE_BREAKING), released],
	function* ({ check, version }) {
		yield* outcomes([
			["applied version", () => version(SHELL), "0.5.0"],
			["check", () => check(), "valid"],
		]);
	},
);
