import { defineConfig } from "vitest/config";
import { testProjects } from "#adapters/testProjects.ts";

const projects = testProjects();

export default defineConfig({
	resolve: {
		conditions: ["@shivaedev/source", "module", "browser", "development|production"],
	},
	ssr: { resolve: { conditions: ["@shivaedev/source", "node", "development|production"] } },
	test: {
		...projects,
		// Every unit file loads the same few hundred modules. Sharing them per worker is safe while the local rule tests/unit-module-state keeps module-level state out of them.
		projects: projects.projects?.map((project) =>
			typeof project === "object" && "test" in project && project.test?.name === "unit"
				? { ...project, test: { ...project.test, isolate: false } }
				: project,
		),
	},
});
