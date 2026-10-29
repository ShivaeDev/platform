import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { seedCiApplication } from "#quality/test-support/seedCiApplication.ts";
import { runQuality } from "#quality-fixtures/cli.ts";
import { writes } from "#quality-fixtures/hookRepository.ts";
import { seedTree } from "#quality-fixtures/tree.ts";

export const appCi = storyKit({
	after: {
		application: (engine) => {
			writes(engine.root, "pnpm-workspace.yaml", "packages: []\n");
			if (engine.testing) {
				seedCiApplication(engine.root, engine.failingTest);
			}
			writes(
				engine.root,
				"package.json",
				JSON.stringify({
					private: true,
					scripts: Object.fromEntries(
						["lint", "typecheck", "build", "test"].map((name) => [
							name,
							`node -e "require('fs').appendFileSync('checks.log', '${name}\\n');${name === "build" && engine.failingBuild ? "process.exit(3);" : ""}"${name === "test" && engine.testing ? " && node --conditions=source node_modules/vitest/vitest.mjs run --configLoader native" : ""}`,
						]),
					),
					type: "module",
				}),
			);
		},
	},
	clock: "live",
	create: () =>
		Effect.acquireRelease(
			Effect.sync(() => {
				const root = seedTree([]);
				return { failingBuild: false, failingTest: false, root, testing: false };
			}),
			({ root }) => Effect.sync(() => rmSync(root, { force: true, recursive: true })),
		),
	name: "application CI",
	stages: ["application"],
	verbs: (engine, story) => ({
		completed: () => readFileSync(join(engine.root, "checks.log"), "utf8"),
		hasCoverage: () => existsSync(join(engine.root, "coverage")),
		read: (path: string) => readFileSync(join(engine.root, path), "utf8"),
		run: (...args: readonly string[]) => {
			story.tell("run the shared application CI gate");
			return Effect.promise(() => runQuality(engine.root, "ci", ...args));
		},
	}),
});

export const failingBuild = appCi.trait("application", "the application's build fails", (engine) => {
	engine.failingBuild = true;
});

export const passingTest = appCi.trait("application", "the application has a passing Vitest test", (engine) => {
	engine.testing = true;
});

export const failingTest = appCi.trait("application", "the application has a failing Vitest test", (engine) => {
	engine.testing = true;
	engine.failingTest = true;
});
