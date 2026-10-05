import { fileURLToPath, pathToFileURL } from "node:url";
import type { testProjects } from "@shivaedev/quality/vitest";
import { testPackages } from "#ci/testPackages.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));

export default async function workspace() {
	type Project = Extract<NonNullable<ReturnType<typeof testProjects>["projects"]>[number], { test?: unknown }>;
	const projects: Project[] = [];
	for (const { configFile, directory, name } of testPackages(root)) {
		const { default: config }: { default: { test?: ReturnType<typeof testProjects> } } = await import(pathToFileURL(configFile).href);
		for (const project of config.test?.projects ?? []) {
			if (typeof project !== "object" || project === null || !("test" in project) || typeof project.test?.name !== "string") {
				throw new Error(`${configFile}: expected named inline test projects`);
			}
			projects.push({
				...project,
				extends: configFile,
				root: directory,
				test: { ...project.test, name: `${name}:${project.test.name}` },
			});
		}
	}
	return {
		root,
		test: {
			coverage: {
				allowExternal: true,
				exclude: ["**/node_modules/**", "**/*.d.ts", "**/*.test.*", "**/*.spec.*"],
				include: [`${root}packages/*/src/**/*.{ts,tsx}`],
				provider: "v8" as const,
				reporter: ["lcov", "json", "text-summary"],
				reportOnFailure: true,
				reportsDirectory: `${root}/.ci/coverage`,
			},
			project: ["*:unit", "*:dom"],
			projects,
		},
	};
}
