import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { runQuality } from "#quality-fixtures/cli.ts";
import { writes } from "#quality-fixtures/hookRepository.ts";
import { qualityTree } from "#quality-fixtures/qualityTree.ts";

function repository() {
	return qualityTree([
		{ content: '{"name":"fixture","private":true,"type":"module","workspaces":["packages/*"]}', path: "package.json" },
		{ content: 'export default { sources: ["packages"] };', path: "quality.config.ts" },
		{
			content:
				'{"name":"app","private":true,"type":"module","bin":{"app":"./dist/launch.js"},"scripts":{"start":"node wrapper.ts -- node src/start.ts"}}',
			path: "packages/app/package.json",
		},
		{ content: 'import { used } from "./values.ts";\nconsole.log(used);\n', path: "packages/app/src/start.ts" },
		{ content: "export const used = 1;\nexport const unused = 2;\n", path: "packages/app/src/values.ts" },
		{ content: "export const orphan = 1;\n", path: "packages/app/src/orphan.ts" },
		{
			content: '{"name":"library","type":"module","exports":{"./*.ts":{"source":"./src/*.ts","types":"./dist/*.d.ts","default":"./dist/*.js"}}}',
			path: "packages/library/package.json",
		},
		{ content: "export const publicValue = 1;\n", path: "packages/library/src/publicValue.ts" },
		{ content: "export const helper = 1;\n", path: "packages/app/src/test-support/helper.ts" },
		{ content: 'import { helper } from "./test-support/helper.ts";\nconsole.log(helper);\n', path: "packages/app/src/values.unit.spec.ts" },
		{ content: "console.log(1);\n", path: "packages/app/src/launch.ts" },
		{ content: "export const view = 1;\n", path: "packages/app/src/view.stories.ts" },
		{ content: '{"name":"exact","type":"module","exports":{".":"./src/publicValue.ts"}}', path: "packages/exact/package.json" },
		{ content: "export const publicValue = 1;\n", path: "packages/exact/src/publicValue.ts" },
	]);
}

export const unusedRepository = storyKit({
	clock: "live",
	create: () => Effect.acquireRelease(Effect.sync(repository), (root) => Effect.sync(() => rmSync(root, { force: true, recursive: true }))),
	name: "Quality unused code",
	stages: ["repository"],
	verbs: (root, story) => ({
		cli: (...args: readonly string[]) =>
			Effect.promise(() => {
				story.tell(`quality ${args.join(" ")}`);
				return runQuality(root, ...args);
			}),
		read: (path: string) => readFileSync(join(root, path), "utf8"),
	}),
});

export const dependencyDebt = unusedRepository.trait(
	"repository",
	"an application declares an unused dependency and imports a missing one",
	(root) => {
		writes(
			root,
			"packages/app/package.json",
			'{"name":"app","private":true,"type":"module","bin":{"app":"./dist/launch.js"},"scripts":{"start":"node wrapper.ts -- node src/start.ts"},"dependencies":{"left-pad":"1.3.0"}}',
		);
		writes(root, "packages/app/src/start.ts", 'import "missing-package";\nimport { used } from "./values.ts";\nconsole.log(used);\n');
	},
);
