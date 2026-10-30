import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { applied, changeset, onMain } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

const breakingPlan = [
	changeset(
		"a-shared",
		{ "@test/api": "minor", "@test/core": "minor" },
		"### Breaking\n\n- Replace `old` → `current`.\n  Pass the service explicitly.\n",
	),
	changeset("z-core", { "@test/core": "minor" }, "### Breaking\n\n- Replace `run` → `execute`.\n"),
	changeset("optional", { "@test/optional": "patch" }, "### Breaking\n\n- Replace `optional()` → `optional.make()`.\n"),
	changeset(
		"rule",
		{ "@test/api": "minor", "@test/core": "minor" },
		"### Quality rules\n\n- `imports/aliased`: record findings with `quality baseline write --rule imports/aliased`; fix cross-folder imports with aliases.\n",
	),
];

workspace.it(
	"apply prints every breaking entry grouped across three packages, then a shared quality rule once with adoption steps",
	breakingPlan,
	function* ({ apply }) {
		const answer = yield* apply();

		expect(answer).toEqual([
			"## Migration checklist",
			"",
			"### @test/api",
			"",
			"- Replace `old` → `current`.",
			"  Pass the service explicitly.",
			"",
			"### @test/core",
			"",
			"- Replace `old` → `current`.",
			"  Pass the service explicitly.",
			"- Replace `run` → `execute`.",
			"",
			"### @test/optional",
			"",
			"- Replace `optional()` → `optional.make()`.",
			"",
			"### Quality rules",
			"",
			"- `imports/aliased`: record findings with `quality baseline write --rule imports/aliased`; fix cross-folder imports with aliases.",
			"@test/api: 0.5.0 -> 0.6.0 (minor)",
			"@test/core: 0.2.3 -> 0.3.0 (minor)",
			"@test/optional: 1.0.0 -> 1.0.1 (patch)",
			"@test/peer: 1.0.0 -> 1.0.1 (patch)",
		]);
	},
);

workspace.it(
	"a patch-only apply prints one line saying there are no migrations before the version plan",
	[changeset("patch", { "@test/dev": "patch" }, "### Fixed\n\n- Fix a patch.\n")],
	function* ({ apply }) {
		const answer = yield* apply();

		expect(answer).toEqual(["No breaking changes or new or stricter quality rules in this release.", "@test/dev: 1.0.0 -> 1.0.1 (patch)"]);
	},
);

workspace.it(
	"apply reports a stricter quality rule without breaking entries and keeps its adoption instructions in the changelog",
	[
		changeset(
			"stricter-rule",
			{ "@test/dev": "patch" },
			"### Quality rules\n\n- `tests/story-specs`: now includes nested suites. Record findings with `quality baseline write --rule tests/story-specs`; fix them by moving setup and actions into a story kit.\n",
		),
	],
	function* ({ apply, changelog, todayInUtc }) {
		const answer = yield* apply();

		yield* outcomes({
			"collected changelog": [
				changelog("@test/dev"),
				`# Changelog\n\n## 1.0.1 - ${yield* todayInUtc()}\n\n### Quality rules\n\n- \`tests/story-specs\`: now includes nested suites. Record findings with \`quality baseline write --rule tests/story-specs\`; fix them by moving setup and actions into a story kit.\n\n## 0.2.3 - 2026-01-01\n\n### Fixed\n\n- Released history.\n`,
			],
			"migration notes": [
				Effect.succeed(answer),
				[
					"## Migration checklist",
					"",
					"### Quality rules",
					"",
					"- `tests/story-specs`: now includes nested suites. Record findings with `quality baseline write --rule tests/story-specs`; fix them by moving setup and actions into a story kit.",
					"@test/dev: 1.0.0 -> 1.0.1 (patch)",
				],
			],
		});
	},
);

workspace.it(
	"checking an applied release accepts quality rule entries collected in its changelogs",
	[...breakingPlan, onMain, applied],
	function* ({ check }) {
		expect(yield* check()).toBe("valid");
	},
);
