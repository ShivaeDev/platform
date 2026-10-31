import { expect } from "vitest";
import { storySetup } from "#rules/stories/setup.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const TEST = "src/cart/cart.test.ts";

const STORY_KIT =
	"Name the setup in domain words as traits of the repository's story kit in test-support/, so the test reads as a story: see https://github.com/ShivaeDev/platform/tree/main/packages/quality#story-tests.";

for (const write of [
	"appendFile",
	"appendFileSync",
	"copyFile",
	"copyFileSync",
	"cp",
	"cpSync",
	"mkdir",
	"mkdirSync",
	"mkdtemp",
	"mkdtempSync",
	"symlink",
	"symlinkSync",
	"writeFile",
	"writeFileSync",
] as const) {
	ruleStory.it(
		`tests/story-setup reports a test that calls ${write} from fs as writing a fixture`,
		[repositoryHas({ content: `import { ${write} } from "fs";\n${write}("a");\n`, path: TEST })],
		function* ({ check }) {
			const findings = yield* check(storySetup);

			expect(findings).toEqual([{ file: TEST, line: 2, message: `Writes a fixture with ${write}. ${STORY_KIT}`, subject: write }]);
		},
	);
}

for (const [route, imports, call, write] of [
	["a renamed import", 'import { writeFileSync as write } from "node:fs";', 'write("a.json", "{}");', "writeFileSync"],
	["a default import", 'import fs from "node:fs";', "fs.mkdirSync(root, { recursive: true });", "mkdirSync"],
	["the imported promises namespace", 'import { promises as fsp } from "node:fs";', 'await fsp.writeFile("b.json", "{}");', "writeFile"],
	["a namespace import of fs/promises", 'import * as files from "fs/promises";', 'await files.cp("a", "b");', "cp"],
	["the promises member of a default import", 'import fs from "node:fs";', 'await fs.promises.appendFile("c.txt", "x");', "appendFile"],
] as const) {
	ruleStory.it(
		`tests/story-setup reports ${write} called through ${route} as writing a fixture`,
		[repositoryHas({ content: `${imports}\n${call}\n`, path: TEST })],
		function* ({ check }) {
			const findings = yield* check(storySetup);

			expect(findings).toEqual([{ file: TEST, line: 2, message: `Writes a fixture with ${write}. ${STORY_KIT}`, subject: write }]);
		},
	);
}

for (const [lookalike, content] of [
	["reads from node:fs", 'import { readFileSync, existsSync } from "node:fs";\nreadFileSync("a.json");\nexistsSync("a.json");\n'],
	["a writeFileSync of another module", 'import { writeFileSync } from "./disk.ts";\nwriteFileSync("a.json");\n'],
] as const) {
	ruleStory.it(`tests/story-setup leaves ${lookalike} alone`, [repositoryHas({ content, path: TEST })], function* ({ check }) {
		expect(yield* check(storySetup)).toEqual([]);
	});
}
