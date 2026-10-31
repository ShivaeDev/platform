import { expect } from "@effect/vitest";
import { filesListed } from "#test/filesListed.ts";
import { CORE } from "#test/fixture.ts";
import { workspace } from "#test/workspace.ts";

for (const files of [["dist", "src"], [], ["*.md", "!CHANGELOG.md"], ["CHANGELOG.md", "!*.md"]]) {
	workspace.it(
		`check refuses ${CORE} when files ${JSON.stringify(files)} leaves out its changelog`,
		[filesListed(CORE, files)],
		function* ({ check }) {
			expect(yield* check()).toBe(
				`refused: ${CORE}: packages/core/package.json files excludes CHANGELOG.md from the npm tarball. Add "CHANGELOG.md" to files and remove any pattern that excludes it.`,
			);
		},
	);
}

for (const files of [["dist", "CHANGELOG.md"], ["./CHANGELOG.md"], ["*.md"], ["*", "!src/**"]]) {
	workspace.it(`check accepts ${CORE} when files ${JSON.stringify(files)} includes its changelog`, [filesListed(CORE, files)], function* ({ check }) {
		expect(yield* check()).toBe("valid");
	});
}

workspace.it("check accepts packages with no files allowlist", [], function* ({ check }) {
	expect(yield* check()).toBe("valid");
});

workspace.it("check permits a private package to omit the changelog from files", [filesListed("@test/private", ["dist"])], function* ({ check }) {
	expect(yield* check()).toBe("valid");
});
