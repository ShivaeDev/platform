import { expect } from "vitest";
import { applied, dependencyRange } from "#release/test-support/dependencyRanges.ts";
import { repository } from "#release/test-support/repository.ts";

for (const range of [
	"0.15.0",
	"^0.15.0",
	"~0.15.0",
	"workspace:0.15.0",
	"workspace:^0.15.0",
	"workspace:~0.15.0",
	"workspace:*",
	"workspace:^",
	"workspace:~",
]) {
	for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
		repository.it(
			`the starter pin check accepts an applied ${range} ${field} range`,
			[dependencyRange(field, range), applied],
			function* ({ check }) {
				expect(yield* check()).toBeUndefined();
			},
		);
	}
}

for (const range of ["0.14.0", "^0.14.0", "~0.14.0", "workspace:0.14.0", "workspace:^0.14.0", "workspace:~0.14.0"]) {
	repository.it(
		`the starter pin check rejects a ${range} range that differs from the pin`,
		[dependencyRange("dependencies", range)],
		function* ({ check }) {
			expect(yield* check()).toContain("@shivaedev/work-fleet@0.3.0 depends on @shivaedev/platform@0.14.0, but its pin is 0.15.0");
		},
	);
}

repository.it(
	"the repository release check names a removed package and its dependent before reporting a stale starter pin",
	[],
	function* ({ write, git, remove, check }) {
		yield* write("packages/retired/package.json", '{"name":"@shivaedev/retired","version":"1.0.0"}\n');
		yield* write("packages/retired/CHANGELOG.md", "# Changelog\n");
		yield* write(
			"examples/starter/published-versions.json",
			'{"@shivaedev/platform":"0.15.0","@shivaedev/work-fleet":"0.3.0","@shivaedev/retired":"1.0.0"}\n',
		);
		yield* write(
			"packages/work-board/package.json",
			'{"name":"@shivaedev/work-board","version":"0.4.0","dependencies":{"@shivaedev/retired":"^1.0.0"}}\n',
		);
		yield* git("add", ".");
		yield* git("commit", "-m", "A published dependency");
		yield* write(
			".changeset/retire.md",
			'---\n"@shivaedev/work-board": minor\n---\n\n### Breaking\n\n- Remove `@shivaedev/retired`; use `@shivaedev/work-board` directly.\n',
		);
		yield* remove("packages/retired/package.json");

		expect(yield* check()).toBe(
			"@shivaedev/work-board depends on removed package @shivaedev/retired; remove or replace this published dependency before planning a release.",
		);
	},
);
