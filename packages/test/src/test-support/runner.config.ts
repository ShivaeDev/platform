import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: { conditions: ["source", "module", "browser", "development|production"] },
	root: fileURLToPath(new URL("../..", import.meta.url)),
	ssr: { resolve: { conditions: ["source", "node", "development|production"] } },
	test: { fileParallelism: false, include: ["src/test-support/*Fixture.ts"] },
});
