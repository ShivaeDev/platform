import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";

const WORKSPACE_PIECES = [
	"@shivaedev/deploy",
	"@shivaedev/platform",
	"@shivaedev/quality",
	"@shivaedev/skills",
	"@shivaedev/test-kits",
	"@shivaedev/test-story",
];
const LAUNCHERS = ["src/test-support/admin/command.ts", "src/test-support/deployChild.ts", "src/test-support/developmentServer.ts"];
const CONDITION_CONFIGS = ["tsconfig.json", "vite.config.ts", "vitest.config.ts", "src/server/dev.ts"];
const RENAMED = [
	["app-agents.md", "AGENTS.md"],
	["app-readme.md", "README.md"],
] as const;

application.it(
	"packing the starter uses catalog references backed by its exact published framework pins and leaves no workspace range",
	[],
	function* ({ pack, packedFrameworkPins, packedRanges, packedWorkspaceRanges, starterPublishedVersions, starterRanges }) {
		expect(yield* starterRanges(WORKSPACE_PIECES)).toEqual(Object.fromEntries(WORKSPACE_PIECES.map((name) => [name, "workspace:*"])));
		const published = yield* starterPublishedVersions(WORKSPACE_PIECES);

		yield* pack();

		yield* outcomes([
			["workspace pieces", () => packedRanges(WORKSPACE_PIECES), Object.fromEntries(WORKSPACE_PIECES.map((name) => [name, "catalog:framework"]))],
			["framework pins", () => packedFrameworkPins(WORKSPACE_PIECES), published],
			["workspace ranges left", () => packedWorkspaceRanges(), []],
		]);
	},
);

application.it("packing the starter drops its check:published script", [], function* ({ pack, packedScript, starterScript }) {
	expect(yield* starterScript("check:published")).toContain("starter-published.ts");

	yield* pack();

	expect(yield* packedScript("check:published")).toBe("no such script");
});

application.it("packing the starter preserves its declared Quality ownership facts", [], function* ({ pack, packedManifest, starterQuality }) {
	const ownership = yield* starterQuality();

	yield* pack();

	expect((yield* packedManifest()).quality).toEqual(ownership);
});

for (const name of ["dev", "migrate"]) {
	application.it(
		`packing the starter drops --conditions=@shivaedev/source from its ${name} script`,
		[],
		function* ({ pack, packedScript, starterScript }) {
			const script = yield* starterScript(name);
			expect(script).toContain("--conditions=@shivaedev/source ");

			yield* pack();

			expect(yield* packedScript(name)).toBe(script.replaceAll("--conditions=@shivaedev/source ", ""));
		},
	);
}

for (const path of LAUNCHERS) {
	application.it(
		`packing the starter drops the --conditions=@shivaedev/source argument from ${path}`,
		[],
		function* ({ pack, packedFile, starterFile }) {
			const source = yield* starterFile(path);
			expect(source).toContain('"--conditions=@shivaedev/source", ');

			yield* pack();

			expect(yield* packedFile(path)).toBe(source.replaceAll('"--conditions=@shivaedev/source", ', ""));
		},
	);
}

for (const path of CONDITION_CONFIGS) {
	application.it(`packing the starter drops the "@shivaedev/source" condition from ${path}`, [], function* ({ pack, packedFile, starterFile }) {
		const source = yield* starterFile(path);
		expect(source).toContain('["@shivaedev/source"]');

		yield* pack();

		expect(yield* packedFile(path)).toBe(source.replaceAll('"@shivaedev/source", ', "").replaceAll('["@shivaedev/source"]', "[]"));
	});
}

for (const [from, to] of RENAMED) {
	application.it(`packing the starter ships ${from} as the app's ${to}`, [], function* ({ pack, packedFile, starterFile }) {
		const source = yield* starterFile(from);

		yield* pack();

		yield* outcomes([
			[from, () => packedFile(from), "not packed"],
			[to, () => packedFile(to), source],
		]);
	});
}

application.it("packing the starter leaves out its published-versions.json and CLAUDE.md", [], function* ({ pack, packedFile }) {
	yield* pack();

	yield* outcomes([
		["CLAUDE.md", () => packedFile("CLAUDE.md"), "not packed"],
		["published-versions.json", () => packedFile("published-versions.json"), "not packed"],
	]);
});
