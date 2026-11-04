import { defineConfig } from "vitest/config";
import { testProjects } from "@shivaedev/quality/adapters/testProjects.ts";

export default defineConfig({
	resolve: { conditions: ["source", "module", "browser", "development|production"] },
	ssr: { resolve: { conditions: ["source", "node", "development|production"] } },
	test: { ...testProjects(), server: { deps: { inline: [/@modelcontextprotocol\/sdk/u, /eventsource-parser/u] } } },
});
