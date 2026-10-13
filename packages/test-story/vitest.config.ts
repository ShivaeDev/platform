import { defineConfig } from "vitest/config";
import { testProjects } from "@shivaedev/quality/testProjects.ts";

export default defineConfig({
	resolve: { conditions: ["source", "module", "browser", "development|production"] },
	ssr: { resolve: { conditions: ["source", "node", "development|production"] } },
	test: { ...testProjects(), tags: [{ name: "bakery-story" }, { name: "mill-story" }] },
});
