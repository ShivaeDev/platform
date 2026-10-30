import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";

const WORKSPACE_PIECES = ["@shivaedev/platform", "@shivaedev/quality", "@shivaedev/test-story"];
const LAUNCHERS = ["src/test-support/adminCommand.ts", "src/test-support/deployChild.ts", "src/test-support/developmentServer.ts"];
const CONDITION_CONFIGS = ["tsconfig.json", "vite.config.ts", "vitest.config.ts", "src/server/dev.ts"];
const RENAMED = [
	["app-agents.md", "AGENTS.md"],
	["app-readme.md", "README.md"],
	["pnpm-workspace.copy.yaml", "pnpm-workspace.yaml"],
] as const;

application.it(
	"packing the starter replaces its workspace:* pieces with their published-versions.json pins and leaves no workspace range",
	[],
	function* ({ pack, packedRanges, packedWorkspaceRanges, starterPublishedVersions, starterRanges }) {
		expect(yield* starterRanges(WORKSPACE_PIECES)).toEqual(Object.fromEntries(WORKSPACE_PIECES.map((name) => [name, "workspace:*"])));
		const published = yield* starterPublishedVersions(WORKSPACE_PIECES);

		yield* pack();

		yield* outcomes({
			"workspace pieces": [packedRanges(WORKSPACE_PIECES), published],
			"workspace ranges left": [packedWorkspaceRanges(), []],
		});
	},
);

application.it("packing the starter drops its check:published script", [], function* ({ pack, packedScript, starterScript }) {
	expect(yield* starterScript("check:published")).toContain("starter-published.ts");

	yield* pack();

	expect(yield* packedScript("check:published")).toBe("no such script");
});

for (const name of ["dev", "migrate"]) {
	application.it(`packing the starter drops --conditions=source from its ${name} script`, [], function* ({ pack, packedScript, starterScript }) {
		const script = yield* starterScript(name);
		expect(script).toContain("--conditions=source ");

		yield* pack();

		expect(yield* packedScript(name)).toBe(script.replaceAll("--conditions=source ", ""));
	});
}

for (const path of LAUNCHERS) {
	application.it(`packing the starter drops the --conditions=source argument from ${path}`, [], function* ({ pack, packedFile, starterFile }) {
		const source = yield* starterFile(path);
		expect(source).toContain('"--conditions=source", ');

		yield* pack();

		expect(yield* packedFile(path)).toBe(source.replaceAll('"--conditions=source", ', ""));
	});
}

for (const path of CONDITION_CONFIGS) {
	application.it(`packing the starter drops the "source" condition from ${path}`, [], function* ({ pack, packedFile, starterFile }) {
		const source = yield* starterFile(path);
		expect(source).toContain('["source"]');

		yield* pack();

		expect(yield* packedFile(path)).toBe(source.replaceAll('"source", ', "").replaceAll('["source"]', "[]"));
	});
}

for (const [from, to] of RENAMED) {
	application.it(`packing the starter ships ${from} as the app's ${to}`, [], function* ({ pack, packedFile, starterFile }) {
		const source = yield* starterFile(from);

		yield* pack();

		yield* outcomes({
			[from]: [packedFile(from), "not packed"],
			[to]: [packedFile(to), source],
		});
	});
}

application.it("packing the starter leaves out its published-versions.json, CLAUDE.md and quality.config.ts", [], function* ({ pack, packedFile }) {
	yield* pack();

	yield* outcomes({
		"CLAUDE.md": [packedFile("CLAUDE.md"), "not packed"],
		"published-versions.json": [packedFile("published-versions.json"), "not packed"],
		"quality.config.ts": [packedFile("quality.config.ts"), "not packed"],
	});
});
