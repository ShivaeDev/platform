import { expect } from "vitest";
import { fence } from "#imports/fence.ts";
import { anything, files, folders, packages } from "#imports/fences/selectors.ts";
import { importFences } from "#rules/imports/fences.ts";
import { fixtureTree } from "#test/fixtureTree.ts";
import { gameFences } from "#test/gameFences.ts";
import { importStory, repositoryHolds } from "#test/importStory.ts";

const { cmsStaysOffDisk, coreNeedsNoAuth, gameKeepsOutOfCms, gameNeverReachesCms, gameSpeaksCards } = gameFences;

const GAME = repositoryHolds(fixtureTree("fence"));

importStory.it(
	"imports/fences reports an import across a fence at the import's line with the fence's reason, and not the test files that make the same import",
	[GAME],
	function* ({ check }) {
		const findings = yield* check(importFences, { fences: [gameKeepsOutOfCms] });

		expect(findings).toEqual([
			{
				file: "packages/game/src/play.ts",
				line: 1,
				message: 'Imports packages/cms/src/edit.ts across the fence "game-keeps-out-of-cms": The game ships to players; the CMS is for contributors.',
				subject: "game-keeps-out-of-cms",
			},
		]);
	},
);

importStory.it(
	"imports/fences reports every path from shipped code that reaches across a transitive fence, naming the path, and no path from test code",
	[GAME],
	function* ({ check, messages }) {
		yield* check(importFences, { fences: [gameNeverReachesCms] });

		expect(yield* messages()).toEqual([
			'Reaches packages/cms/src/edit.ts through packages/game/src/play.ts -> packages/cms/src/edit.ts across the fence "game-never-reaches-cms": Nothing the game loads may pull the CMS in.',
			'Reaches packages/cms/src/edit.ts through packages/game/src/run.ts -> packages/simulation/src/step.ts -> packages/cms/src/edit.ts across the fence "game-never-reaches-cms": Nothing the game loads may pull the CMS in.',
		]);
	},
);

importStory.it(
	"imports/fences reports an import of a vocabulary subject the fence does not allow, naming the subject, and not the test code that imports it",
	[GAME],
	function* ({ check, findings }) {
		yield* check(importFences, { fences: [gameSpeaksCards] });

		expect(yield* findings()).toEqual([
			expect.objectContaining({
				file: "packages/game/src/words.ts",
				line: 2,
				message: expect.stringContaining('Imports "voyage" of packages/vocabulary/src across the fence "game-speaks-cards"'),
			}),
		]);
	},
);

importStory.it("imports/fences reports a builtin module that an import spells without the node: prefix", [GAME], function* ({ check, locations }) {
	yield* check(importFences, { fences: [cmsStaysOffDisk] });

	expect(yield* locations()).toEqual(["packages/cms/src/edit.ts:1"]);
});

importStory.it(
	"imports/fences sees through a package.json alias, a tsconfig path, a relative path and types-only packages to the package an import names",
	[repositoryHolds(fixtureTree("aliases"))],
	function* ({ check, messages }) {
		yield* check(importFences, { fences: [coreNeedsNoAuth] });

		expect((yield* messages()).map((message) => message.split(" across ")[0])).toEqual([
			"Imports #auth (better-auth)",
			"Imports auth-kit (better-auth)",
			"Imports ../../../node_modules/@trpc/server/src/http.ts (@trpc/server)",
			"Imports hast",
			"Imports @demo/kit",
		]);
	},
);

importStory.it(
	"imports/fences keeps a file under a package.json nested in a workspace package inside that workspace package",
	[repositoryHolds(fixtureTree("nested"))],
	function* ({ check, locations }) {
		yield* check(importFences, { fences: [gameKeepsOutOfCms] });

		expect(yield* locations()).toEqual(["packages/game/src/preview.ts:1"]);
	},
);

importStory.it(
	"imports/fences reports an import of a file its generator has not written yet",
	[repositoryHolds(fixtureTree("pending"))],
	function* ({ check, messages }) {
		yield* check(importFences, { fences: [gameKeepsOutOfCms] });

		expect(yield* messages()).toEqual([expect.stringContaining("Imports packages/cms/generated/client.ts across the fence")]);
	},
);

importStory.it(
	"imports/fences reports an import from named files across a fence and allows the import the fence excepts",
	[GAME],
	function* ({ check }) {
		const policy = fence("game")
			.because("The editor is not shipped to players.")
			.from(files("packages/game/src/play.ts"))
			.mayNotImport(anything.except(files("packages/simulation/src/step.ts")))
			.demonstratedBy({
				illegal: ["packages/game/src/play.ts", "packages/cms/src/edit.ts"],
				legal: ["packages/game/src/play.ts", "packages/simulation/src/step.ts"],
			});

		const findings = yield* check(importFences, { fences: [policy] });

		expect(findings).toEqual([
			{
				file: "packages/game/src/play.ts",
				line: 1,
				message: 'Imports packages/cms/src/edit.ts across the fence "game": The editor is not shipped to players.',
				subject: "game",
			},
		]);
	},
);

importStory.it("imports/fences takes a folder as a vocabulary boundary", [GAME], function* ({ check, locations }) {
	const policy = fence("words")
		.because("Use card words only.")
		.from(packages("game"))
		.mayImportOnly("cards", "session")
		.of(folders("packages/vocabulary/src/"))
		.demonstratedBy({
			illegal: ["packages/game/src/a.ts", "packages/vocabulary/src/voyage/a.ts"],
			legal: ["packages/game/src/a.ts", "packages/vocabulary/src/cards.ts"],
		});

	yield* check(importFences, { fences: [policy] });

	expect(yield* locations()).toEqual(["packages/game/src/words.ts:2"]);
});
