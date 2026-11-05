import { testProjects } from "@shivaedev/test-kits/quality/adapters/testProjects.ts";

export default {
	resolve: { conditions: ["@shivaedev/source", "module", "browser", "development|production"] },
	ssr: { resolve: { conditions: ["@shivaedev/source", "node", "development|production"] } },
	test: testProjects(),
};
