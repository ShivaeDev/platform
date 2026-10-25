import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { runQuality } from "#quality-fixtures/cli.ts";
import { writes } from "#quality-fixtures/hookRepository.ts";
import { seedTree } from "#quality-fixtures/tree.ts";

export const appCi = storyKit({
	after: {
		application: (engine) => {
			writes(engine.root, "pnpm-workspace.yaml", "packages: []\n");
			writes(
				engine.root,
				"package.json",
				JSON.stringify({
					private: true,
					scripts: Object.fromEntries(
						["lint", "typecheck", "build", "test"].map((name) => [
							name,
							`node -e "require('fs').appendFileSync('checks.log', '${name}\\n');${name === "build" && engine.failingBuild ? "process.exit(3);" : ""}"`,
						]),
					),
				}),
			);
		},
	},
	clock: "live",
	create: () =>
		Effect.acquireRelease(
			Effect.sync(() => {
				const root = seedTree([]);
				return { failingBuild: false, root };
			}),
			({ root }) => Effect.sync(() => rmSync(root, { force: true, recursive: true })),
		),
	name: "application CI",
	stages: ["application"],
	verbs: (engine, story) => ({
		completed: () => readFileSync(join(engine.root, "checks.log"), "utf8"),
		run: () => {
			story.tell("run the shared application CI gate");
			return Effect.promise(() => runQuality(engine.root, "ci"));
		},
	}),
});

export const failingBuild = appCi.trait("application", "the application's build fails", (engine) => {
	engine.failingBuild = true;
});
