import { testProjects } from "@shivaedev/quality/adapters/testProjects.ts";

export default {
	resolve: { conditions: ["source", "module", "browser", "development|production"] },
	ssr: { resolve: { conditions: ["source", "node", "development|production"] } },
	test: testProjects(),
};
