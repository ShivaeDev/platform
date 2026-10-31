import { expect } from "vitest";
import { noTestCode } from "#rules/imports/noTestCode.ts";
import { importStory, repositoryHas } from "#test/importStory.ts";

const REPAIR = "Move the shared code into a production module and import it from both production and tests.";

const FORMS = [
	["a static import of a test file", 'import { fixture } from "./fixture.test.ts";', "./fixture.test.ts", "src/fixture.test.ts"],
	["an import of a spec file", 'import { fixture } from "./fixture.spec.ts";', "./fixture.spec.ts", "src/fixture.spec.ts"],
	["an import of a DOM test", 'import { fixture } from "./fixture.dom.test.tsx";', "./fixture.dom.test.tsx", "src/fixture.dom.test.tsx"],
	[
		"a type import of a typecheck test",
		'import type { Fixture } from "./fixture.typecheck.test.ts";',
		"./fixture.typecheck.test.ts",
		"src/fixture.typecheck.test.ts",
	],
	["a re-export of test support", 'export { fixture } from "./test-support/fixture.ts";', "./test-support/fixture.ts", "src/test-support/fixture.ts"],
	[
		"a type re-export of test support",
		'export type { Fixture } from "./test-support/fixture.ts";',
		"./test-support/fixture.ts",
		"src/test-support/fixture.ts",
	],
	[
		"a dynamic import of test support",
		'const loaded = import("./test-support/fixture.ts");',
		"./test-support/fixture.ts",
		"src/test-support/fixture.ts",
	],
	[
		"a require call of test support",
		'const loaded = require("./test-support/fixture.cjs");',
		"./test-support/fixture.cjs",
		"src/test-support/fixture.cjs",
	],
	[
		"an import of nested test support",
		'import { fixture } from "./test-support/nested/fixture.ts";',
		"./test-support/nested/fixture.ts",
		"src/test-support/nested/fixture.ts",
	],
] as const;

for (const [form, content, specifier, target] of FORMS) {
	importStory.it(
		`imports/no-test-code reports ${form} from production code and names the repair`,
		[repositoryHas({ content, path: "src/app.ts" }, { content: "export const fixture = 1; export type Fixture = number;", path: target })],
		function* ({ check }) {
			const findings = yield* check(noTestCode);

			expect(findings).toEqual([{ file: "src/app.ts", line: 1, message: `Imports test code through "${specifier}". ${REPAIR}`, subject: specifier }]);
		},
	);
}

importStory.it(
	"imports/no-test-code reports an import of a test-support asset from production code",
	[
		repositoryHas(
			{ content: 'import fixture from "./test-support/fixture.json";', path: "src/app.ts" },
			{ content: "{}", path: "src/test-support/fixture.json" },
		),
	],
	function* ({ check, sites }) {
		yield* check(noTestCode);

		expect(yield* sites()).toEqual(["src/app.ts:1 ./test-support/fixture.json"]);
	},
);

importStory.it(
	"imports/no-test-code follows a package.json alias into test support and reports a missing path under test support",
	[
		repositoryHas(
			{ content: '{ "imports": { "#kit/*": "./src/test-support/*" } }', path: "package.json" },
			{ content: 'import { fixture } from "#kit/fixture.ts";\nimport "./test-support/missing.ts";', path: "src/app.ts" },
			{ content: "export const fixture = 1;", path: "src/test-support/fixture.ts" },
		),
	],
	function* ({ check, sites }) {
		yield* check(noTestCode);

		expect(yield* sites()).toEqual(["src/app.ts:1 #kit/fixture.ts", "src/app.ts:2 ./test-support/missing.ts"]);
	},
);

importStory.it(
	"imports/no-test-code accepts production imports of production code and tests or test support that import anything",
	[
		repositoryHas(
			{ content: 'import { shared } from "./shared.ts";', path: "src/app.ts" },
			{ content: "export const shared = 1;", path: "src/shared.ts" },
			{ content: 'import "./test-support/fixture.ts";\nimport "./app.ts";', path: "src/app.slow.test.ts" },
			{ content: 'import "../app.slow.test.ts";\nimport "../app.ts";', path: "src/test-support/fixture.ts" },
		),
	],
	function* ({ check }) {
		expect(yield* check(noTestCode)).toEqual([]);
	},
);
