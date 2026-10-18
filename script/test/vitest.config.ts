import { fileURLToPath, pathToFileURL } from "node:url";
import type { TestProjectConfiguration } from "vitest/config";
import type { testProjects } from "@shivaedev/quality/testProjects.ts";
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
				// The project filter makes every package a coverage root, and Vitest matches a file against these globs relative to its package.
				allowExternal: true,
				exclude: ["**/*.d.ts", "**/*.test.*", "**/*.spec.*", "**/test-support/**"],
				include: ["src/**/*.{ts,tsx}"],
				provider: "v8" as const,
				reporter: ["lcov", "text-summary"],
				reportOnFailure: true,
				reportsDirectory: `${root}.ci/coverage`,
			},
			project: ["*:unit", "*:dom"],
			projects,
			sequence: { sequencer: TestSequencer },
		},
	};
}
