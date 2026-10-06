import { fileURLToPath, pathToFileURL } from "node:url";
import type { TestProjectConfiguration } from "vitest/config";
import { inheritTags, type testProjects } from "@shivaedev/quality/vitest.ts";
import { TestSequencer } from "#ci/TestSequencer.ts";
import { testPackages } from "#ci/testPackages.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));

export default async function workspace() {
	const projects: TestProjectConfiguration[] = [];
	for (const { configFile, directory, name } of testPackages(root)) {
		const { default: config }: { default: { test?: ReturnType<typeof testProjects> } } = await import(pathToFileURL(configFile).href);
		for (const project of config.test?.projects ?? []) {
			if (typeof project !== "object" || project === null || !("test" in project) || typeof project.test?.name !== "string") {
				throw new Error(`${configFile}: expected named inline test projects`);
			}
			projects.push({ ...project, extends: configFile, root: directory, test: { ...project.test, name: `${name}:${project.test.name}` } });
		}
	}
	return {
		cacheDir: `${root}.ci/vite`,
		root,
		test: {
			coverage: {
				// The project filter makes every package a coverage root, and each root counts the other packages only as external files.
				allowExternal: true,
				exclude: ["**/*.d.ts", "**/*.test.*", "**/*.spec.*", "**/test-support/**"],
				include: [`${root}packages/*/src/**/*.{ts,tsx}`],
				provider: "v8" as const,
				reporter: ["lcov", "text-summary"],
				reportOnFailure: true,
				reportsDirectory: `${root}.ci/coverage`,
			},
			project: ["*:unit", "*:dom"],
			projects: await inheritTags(projects, root),
			sequence: { sequencer: TestSequencer },
		},
	};
}
