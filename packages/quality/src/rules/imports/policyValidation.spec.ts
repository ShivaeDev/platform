import { expect } from "vitest";
import { fence } from "#imports/fence.ts";
import { anyOf, anything, external, files, folders, modules, packages, scopes, workspace } from "#imports/fences/selectors.ts";
import { importFences } from "#rules/imports/fences.ts";
import { fixtureTree } from "#test/fixtureTree.ts";
import { gameFences } from "#test/gameFences.ts";
import { importStory, repositoryHas, repositoryHolds } from "#test/importStory.ts";

const GAME = repositoryHolds(fixtureTree("fence"));

const examples = {
	illegal: ["packages/game/src/play.ts", "packages/cms/src/edit.ts"],
	legal: ["packages/game/src/play.ts", "packages/simulation/src/step.ts"],
} as const;

const EMPTY_SELECTORS = [
	[packages(), "packages() names nothing"],
	[folders(), "folders() names nothing"],
	[files(), "files() names nothing"],
	[modules(), "modules() names nothing"],
	[scopes(), "scopes() names nothing"],
	[anyOf(), "anyOf() names nothing"],
	[anything.except(), "except() names nothing"],
	[files("packages/game/src/missing.ts"), 'files("packages/game/src/missing.ts") is no checked file'],
	[modules("./local"), 'modules("./local") is no package name'],
	[scopes("@demo/cms"), 'scopes("@demo/cms") is no scope such as "@types"'],
] as const;

const UNUSABLE_VOCABULARIES = [
	[folders("packages/vocabulary/missing"), ["cards"], 'folders("packages/vocabulary/missing") holds no checked file'],
	[packages("vocabulary", "cms"), ["cards"], "of() takes one package or one folder"],
	[packages("missing"), ["cards"], 'no workspace package is named "missing"'],
	[packages("vocabulary"), [], "mayImportOnly() names no subject"],
] as const;

importStory.it(
	"imports/fences refuses an empty import graph even when no fences are configured",
	[repositoryHas({ content: '{"name":"demo"}', path: "package.json" })],
	function* ({ refusal }) {
		expect(yield* refusal(importFences, { fences: [] })).toContain("the import graph covers no modules");
	},
);

for (const [name, reason, problem] of [
	[" ", "A reason.", "fence 0: has no name"],
	["game", " ", 'fence "game": because() gives no reason'],
] as const) {
	importStory.it(`imports/fences refuses a fence named "${name}" with the reason "${reason}"`, [GAME], function* ({ refusal }) {
		const policy = fence(name).because(reason).from(packages("game")).mayNotImport(packages("cms")).demonstratedBy(examples);

		expect(yield* refusal(importFences, { fences: [policy] })).toContain(problem);
	});
}

importStory.it("imports/fences refuses two fences with the same name, whose findings would be ambiguous", [GAME], function* ({ refusal }) {
	const policy = fence("game").because("A reason.").from(packages("game")).mayNotImport(packages("cms")).demonstratedBy(examples);

	expect(yield* refusal(importFences, { fences: [policy, policy] })).toContain('fence "game": an earlier fence has this name');
});

for (const [target, problem] of EMPTY_SELECTORS) {
	importStory.it(`imports/fences refuses a selector that would silently protect nothing: ${problem}`, [GAME], function* ({ refusal }) {
		const policy = fence("game").because("A reason.").from(packages("game")).mayNotImport(target).demonstratedBy(examples);

		expect(yield* refusal(importFences, { fences: [policy] })).toContain(problem);
	});
}

importStory.it(
	"imports/fences refuses to select the workspace in a repository without workspace packages",
	[repositoryHolds(fixtureTree("cycle"))],
	function* ({ refusal }) {
		const policy = fence("game").because("A reason.").from(workspace).mayNotImport(modules("node:fs")).demonstratedBy(examples);

		expect(yield* refusal(importFences, { fences: [policy] })).toContain(
			"workspace selects nothing, since no named package.json among the sources is a member of the workspace that pnpm-workspace.yaml or the root package.json declares",
		);
	},
);

importStory.it(
	"imports/fences requires a scoped package name when two workspace members share a short name",
	[
		repositoryHas(
			{ content: "packages:\n  - packages/*\n", path: "pnpm-workspace.yaml" },
			{ content: '{"name":"@one/cms"}', path: "packages/one/package.json" },
			{ content: '{"name":"@two/cms"}', path: "packages/two/package.json" },
			{ content: "export const value = 1;", path: "packages/one/src/main.ts" },
			{ content: "export const value = 2;", path: "packages/two/src/main.ts" },
		),
	],
	function* ({ refusal }) {
		const policy = fence("cms").because("A reason.").from(packages("cms")).mayNotImport(modules("node:fs")).demonstratedBy(examples);

		expect(yield* refusal(importFences, { fences: [policy] })).toContain('more than one workspace package is named "cms"');
	},
);

importStory.it("imports/fences refuses an example that imports from an external module before its last step", [GAME], function* ({ refusal }) {
	const policy = fence("game")
		.because("A reason.")
		.from(packages("game"))
		.mayNotReach(modules("effect"))
		.demonstratedBy({ illegal: ["packages/game/src/play.ts", external("bridge"), external("effect")], legal: examples.legal });

	expect(yield* refusal(importFences, { fences: [policy] })).toContain(
		'fence "game": an example imports from an external module; only its last step may be external()',
	);
});

importStory.it("imports/fences refuses a package and a folder the repository does not have, naming both", [GAME], function* ({ refusal }) {
	const typo = fence("typo")
		.because("Typos must not pass silently.")
		.from(folders("packages/gaem/src"))
		.mayNotImport(packages("cmss"))
		.demonstratedBy({ illegal: ["packages/gaem/src/a.ts", "packages/cmss/src/b.ts"], legal: ["packages/gaem/src/a.ts", external("effect")] });

	expect(yield* refusal(importFences, { fences: [typo] })).toBe(
		[
			"the fence policy is invalid:",
			'  - fence "typo".from: folders("packages/gaem/src") holds no checked file',
			'  - fence "typo".to: no workspace package is named "cmss"',
		].join("\n"),
	);
});

importStory.it(
	"imports/fences refuses a fence whose illegal example crosses another fence too, so every fence stays an independent prohibition",
	[GAME],
	function* ({ refusal }) {
		const overlapping = fence("game-keeps-out-of-workspace")
			.because("The game is a leaf.")
			.from(folders("packages/game/src"))
			.mayNotImport(workspace.except(packages("game")))
			.demonstratedBy({
				illegal: ["packages/game/src/play.ts", "packages/cms/src/edit.ts"],
				legal: ["packages/game/src/play.ts", external("effect")],
			});

		expect(yield* refusal(importFences, { fences: [gameFences.gameKeepsOutOfCms, overlapping] })).toContain(
			'fence "game-keeps-out-of-workspace": the illegal example packages/game/src/play.ts -> packages/cms/src/edit.ts must cross this fence alone, and crosses game-keeps-out-of-cms, game-keeps-out-of-workspace',
		);
	},
);

for (const [unit, subjects, problem] of UNUSABLE_VOCABULARIES) {
	importStory.it(`imports/fences refuses an unusable vocabulary boundary: ${problem}`, [GAME], function* ({ refusal }) {
		const policy = fence("words")
			.because("A reason.")
			.from(packages("game"))
			.mayImportOnly(...subjects)
			.of(unit)
			.demonstratedBy(examples);

		expect(yield* refusal(importFences, { fences: [policy] })).toContain(problem);
	});
}

importStory.it("imports/fences refuses a vocabulary that names a subject its folder does not hold", [GAME], function* ({ refusal }) {
	const wrong = fence("wrong")
		.because("Examples must be true.")
		.from(folders("packages/game/src"))
		.mayImportOnly("cards", "stories")
		.of(packages("vocabulary"))
		.demonstratedBy({
			illegal: ["packages/game/src/play.ts", "packages/vocabulary/src/session.ts"],
			legal: ["packages/game/src/play.ts", "packages/vocabulary/src/voyage/route.ts"],
		});

	expect(yield* refusal(importFences, { fences: [wrong] })).toContain(
		'fence "wrong".of: "stories" is no module or folder directly in packages/vocabulary/src',
	);
});

importStory.it(
	"imports/fences refuses a fence whose illegal example crosses nothing and whose legal example crosses it",
	[GAME],
	function* ({ refusal }) {
		const wrong = fence("wrong")
			.because("Examples must be true.")
			.from(folders("packages/game/src"))
			.mayImportOnly("cards", "session")
			.of(packages("vocabulary"))
			.demonstratedBy({
				illegal: ["packages/game/src/play.ts", "packages/vocabulary/src/session.ts"],
				legal: ["packages/game/src/play.ts", "packages/vocabulary/src/voyage/route.ts"],
			});

		expect(yield* refusal(importFences, { fences: [wrong] })).toContain(
			[
				'  - fence "wrong": the illegal example packages/game/src/play.ts -> packages/vocabulary/src/session.ts must cross this fence alone, and crosses none',
				'  - fence "wrong": the legal example packages/game/src/play.ts -> packages/vocabulary/src/voyage/route.ts crosses wrong',
			].join("\n"),
		);
	},
);
