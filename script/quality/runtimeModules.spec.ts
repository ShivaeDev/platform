import { expect } from "vitest";
import { moduleFiles, runtimeModules } from "#quality/test-support/runtimeModules.ts";

runtimeModules.it(
	"keeps module runtime boundaries while sharing foundation code",
	[
		moduleFiles([
			{ content: "export const button = 1;", path: "src/client/button.ts" },
			{ content: "export const pool = 1;", path: "src/server/pool.ts" },
			{ content: 'import "../../../client/button.ts";\nimport "../contract.ts";', path: "src/modules/notes/client/screen.ts" },
			{ content: 'import "../../../server/pool.ts";\nimport "node:fs";', path: "src/modules/notes/server/service.ts" },
			{ content: "export const contract = 1;", path: "src/modules/notes/contract.ts" },
			{ content: 'import "../server/service.ts";', path: "src/modules/notes/client/invalid.ts" },
			{ content: 'import "./client/screen.ts";\nimport "./server/service.ts";', path: "src/modules/notes/shared.ts" },
		]),
	],
	function* ({ check }) {
		expect(yield* check()).toEqual([
			{ file: "src/modules/notes/client/invalid.ts", subject: "../server/service.ts" },
			{ file: "src/modules/notes/shared.ts", subject: "./client/screen.ts" },
			{ file: "src/modules/notes/shared.ts", subject: "./server/service.ts" },
		]);
	},
);
