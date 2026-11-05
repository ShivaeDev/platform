import { unusedCode } from "#rules/unusedCode.ts";
import { repositoryHas as cliRepositoryHas, qualityInstalled, repositoryStory } from "#test/repositoryStory.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { unusedWorktree } from "#test/unusedWorktree.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

repositoryStory.it(
	"quality surfaces knip's exit code and broken tsconfig extends error without a schema error",
	[
		qualityInstalled(),
		cliRepositoryHas(
			{ content: '{"name":"broken-app","type":"module","scripts":{"start":"node src/main.ts"}}', path: "package.json" },
			{ content: '{"extends":"./missing-base.json"}', path: "tsconfig.json" },
			{ content: "console.log(1);", path: "src/main.ts" },
		),
	],
	function* ({ runs, stdout }) {
		const answer = yield* runs("lint");

		yield* assertThat(answer.outcome, (actual) => actual.toBe("rejected"));
		const error = yield* stdout();
		yield* assertThat(error, (actual) => actual.toContain("knip exited 1 without a valid report:"));
		yield* assertThat(error, (actual) => actual.toContain("missing-base.json"));
		yield* assertThat(error, (actual) => actual.not.toContain("SchemaError"));
	},
);

ruleStory.it(
	"code/unused uses the nested worktree's TypeScript config independently of the parent checkout and process cwd",
	[
		repositoryHas(
			{ content: "node_modules/\n.worktrees/\n", path: ".gitignore" },
			{ content: '{"name":"app","type":"module","scripts":{"start":"node src/main.ts"}}', path: "package.json" },
			{ content: '{"compilerOptions":{"paths":{"#app/*":["./src/*"]}},"include":["src"]}', path: "tsconfig.json" },
			{ content: 'import { value } from "#app/value.ts"; console.log(value);', path: "src/main.ts" },
			{ content: "export const value = 1;", path: "src/value.ts" },
		),
		unusedWorktree(),
	],
	function* ({ check, findings }) {
		yield* check(unusedCode, undefined, ".worktrees/app");

		yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
	},
);
