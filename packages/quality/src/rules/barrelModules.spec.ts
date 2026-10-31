import { expect } from "vitest";
import { noBarrel } from "#rules/noBarrel.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const path of ["src/index.ts", "src/nested/index.tsx"]) {
	ruleStory.it(
		`structure/no-barrel reports ${path} even when it defines its own exports and asks for a name after its purpose`,
		[repositoryHas({ content: "export function index() { return 1; }", path })],
		function* ({ check }) {
			const findings = yield* check(noBarrel);

			expect(findings).toEqual([{ file: path, message: expect.stringContaining("Name the module after its purpose") }]);
		},
	);
}

for (const path of ["src/indexed.tsx", "src/index.d.ts"]) {
	ruleStory.it(`structure/no-barrel accepts ${path}`, [repositoryHas({ content: "", path })], function* ({ check }) {
		expect(yield* check(noBarrel)).toEqual([]);
	});
}
