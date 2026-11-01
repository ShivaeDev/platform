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
