import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { permissiveUmask, restrictiveUmask } from "#test/traits.ts";

const APP_WORDS = ["pnpm dev", "pnpm test", "docs/framework/"];
const STARTER_WORDS = ["starter", "check:published", "--registry", "published-versions"];
const UPDATE_WORDS = ["pnpm dlx @shivaedev/create-app@latest update", "`.create-app.json` records the generator version"];

application.it(
	"create-app demo writes package.json tab-indented, named demo, with the starter's fields in the starter's order",
	[],
	function* ({ createApp, fileLines, manifestFields, starterManifestFields }) {
		const starterOrder = yield* starterManifestFields();

		yield* createApp("demo", "--no-git");

		yield* outcomes({
			"field order": [manifestFields(), starterOrder],
			"opening lines": [fileLines("package.json", 2), ["{", '\t"name": "demo",']],
		});
	},
);

application.it("create-app demo titles README.md with the app's name", [], function* ({ createApp, fileLines }) {
	yield* createApp("demo", "--no-git");

	expect(yield* fileLines("README.md", 1)).toEqual(["# demo"]);
});

for (const guide of ["README.md", "AGENTS.md"]) {
	application.it(
		`the generated ${guide} points to pnpm dev, pnpm test and docs/framework/ and names none of the starter's maintenance`,
		[],
		function* ({ createApp, wordsIn }) {
			yield* createApp("demo", "--no-git");

			expect(yield* wordsIn(guide, [...APP_WORDS, ...STARTER_WORDS])).toEqual(APP_WORDS);
		},
	);
}

application.it("the generated README.md explains create-app update and the .create-app.json record", [], function* ({ createApp, wordsIn }) {
	yield* createApp("demo", "--no-git");

	expect(yield* wordsIn("README.md", UPDATE_WORDS)).toEqual(UPDATE_WORDS);
});

application.it("CLAUDE.md links to the generated AGENTS.md", [], function* ({ createApp, guidanceLink }) {
	yield* createApp("demo", "--no-git");

	expect(yield* guidanceLink()).toBe("AGENTS.md");
});

application.it("create-app demo names the databases in .env.example demo_dev and demo_test", [], function* ({ createApp, wordsIn }) {
	yield* createApp("demo", "--no-git");

	expect(yield* wordsIn(".env.example", ["/demo_dev\n", "/demo_test\n", "starter_"])).toEqual(["/demo_dev\n", "/demo_test\n"]);
});

application.it(
	"under a 077 umask every generated and installed file is readable by others at 644, except .env.local at 600",
	[restrictiveUmask],
	function* ({ createApp, modesOtherThan644 }) {
		yield* createApp("demo", "--no-git");

		expect(yield* modesOtherThan644()).toEqual({ ".env.local": "600" });
	},
);

application.it(
	"under a 022 umask create-app still writes .env.local readable only by its owner",
	[permissiveUmask],
	function* ({ createApp, fileMode }) {
		yield* createApp("demo", "--no-git");

		expect(yield* fileMode(".env.local")).toBe("600");
	},
);

application.it("no generated file is named after or mentions the starter", [], function* ({ createApp, filesMentioningStarter }) {
	yield* createApp("demo", "--no-git");

	expect(yield* filesMentioningStarter()).toEqual([]);
});

application.it("the generated CI workflow is the starter's ci.yml", [], function* ({ createApp, file, starterFile }) {
	const workflow = yield* starterFile(".github/workflows/ci.yml");

	yield* createApp("demo", "--no-git");

	expect(yield* file(".github/workflows/ci.yml")).toBe(workflow);
});

application.it("the generated CI workflow runs the tests with coverage and uploads them as coverage-tests", [], function* ({ createApp, wordsIn }) {
	yield* createApp("demo", "--no-git");

	expect(yield* wordsIn(".github/workflows/ci.yml", ["run: pnpm run ci --coverage", "name: coverage-tests"])).toEqual([
		"run: pnpm run ci --coverage",
		"name: coverage-tests",
	]);
});

application.it("the generated app's Git ignores the coverage reports CI writes", [], function* ({ createApp, gitState }) {
	yield* createApp("demo");

	yield* outcomes({
		"coverage/job.txt": [gitState("coverage/job.txt"), "ignored"],
		"coverage/junit.xml": [gitState("coverage/junit.xml"), "ignored"],
		"coverage/lcov.info": [gitState("coverage/lcov.info"), "ignored"],
		"coverage/measured-commits.txt": [gitState("coverage/measured-commits.txt"), "ignored"],
	});
});

application.it(
	"a generated app has no chart or tooltip component and no Recharts dependency",
	[],
	function* ({ createApp, dependsOn, filesPresent }) {
		yield* createApp("demo", "--no-git");

		yield* outcomes({
			"chart and tooltip components": [filesPresent(["src/client/ui/chart.tsx", "src/client/ui/tooltip.tsx"]), []],
			"Recharts dependency": [dependsOn("recharts"), false],
		});
	},
);

application.it(
	"a generated app runs browser-check only through its own script, which no other script and not the CI workflow calls",
	[],
	function* ({ createApp, devDependsOn, script, scriptsMentioning, wordsIn }) {
		yield* createApp("demo", "--no-git");

		yield* outcomes({
			"browser tools the CI workflow names": [wordsIn(".github/workflows/ci.yml", ["browser-check", "playwright"]), []],
			"browser-check devDependency": [devDependsOn("@shivaedev/browser-check"), true],
			"browser-check script": [script("browser-check"), "browser-check"],
			"scripts that call it": [scriptsMentioning(["browser-check", "playwright"]), ["browser-check"]],
		});
	},
);

application.it("the generated app's Git ignores browser-check screenshots in .browser-check/", [], function* ({ createApp, gitState }) {
	yield* createApp("demo");

	expect(yield* gitState(".browser-check/1.png")).toBe("ignored");
});
