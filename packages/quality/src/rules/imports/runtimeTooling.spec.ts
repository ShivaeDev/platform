import { afterEach, describe, expect, it } from "vitest";
import { importsRuntime } from "#rules/imports/runtime.ts";
import { findingsIn, linkWorkspace, scanned } from "#test/imports.ts";
import { run } from "#test/run.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("server tooling conventions", () => {
	it.each(["./src/cli.ts", { worker: "./src/cli.ts" }])("treats a package with bin %j as server code outside selected sources", async (bin) => {
		const root = seedTree([
			{ content: '{"workspaces":["modules/*"]}', path: "package.json" },
			{ content: '{"name":"app"}', path: "modules/app/package.json" },
			{ content: JSON.stringify({ bin, exports: { "./api.ts": "./src/api.ts" }, name: "worker" }), path: "modules/worker/package.json" },
			{ content: 'import type { Api } from "worker/api.ts";\nexport * from "../../../worker/src/cli.ts";', path: "modules/app/src/client/app.ts" },
			{ content: 'export * from "worker/api.ts";', path: "modules/app/src/shared.ts" },
			{ content: 'import "worker/api.ts";', path: "modules/app/src/server/app.ts" },
			{ content: "export type Api = string;", path: "modules/worker/src/api.ts" },
			{ content: 'import "node:fs";', path: "modules/worker/src/cli.ts" },
		]);
		linkWorkspace(root, "worker", "modules/worker");
		const inputs = await scanned(root);
		const configured = await importsRuntime.configure(undefined);
		if (configured._tag !== "Ready") {
			throw new Error("runtime rule must configure without options");
		}
		const sources = inputs.sources.filter(({ path }) => path.startsWith("modules/app/"));
		expect((await run(configured.check({ ...inputs, sources }))).map(({ file, subject }) => ({ file, subject }))).toEqual([
			{ file: "modules/app/src/client/app.ts", subject: "worker/api.ts" },
			{ file: "modules/app/src/client/app.ts", subject: "../../../worker/src/cli.ts" },
			{ file: "modules/app/src/shared.ts", subject: "worker/api.ts" },
		]);
	});

	it("keeps runtime folders authoritative in executable packages, including the workspace root", async () => {
		const root = seedTree([
			{ content: '{"bin":"./src/server/cli.ts"}', path: "package.json" },
			{ content: 'import "../shared.ts";\nimport "../server/cli.ts";', path: "src/client/app.ts" },
			{ content: 'import "./server/cli.ts";\nwindow.alert("hi");', path: "src/shared.ts" },
			{ content: 'import "node:fs";', path: "src/server/cli.ts" },
		]);
		expect((await findingsIn(importsRuntime, undefined, root)).map(({ file, subject }) => ({ file, subject }))).toEqual([
			{ file: "src/client/app.ts", subject: "../server/cli.ts" },
			{ file: "src/shared.ts", subject: "./server/cli.ts" },
			{ file: "src/shared.ts", subject: "window" },
		]);
	});

	it("classifies only package-root tooling and allows its Node imports", async () => {
		const root = seedTree([
			{ content: '{"workspaces":["modules/*"]}', path: "package.json" },
			{ content: '{"name":"app","engines":{"node":">=24"}}', path: "modules/app/package.json" },
			{
				content: 'import "../../../script/task.ts";\nimport "../vitest.config.ts";\nimport "./tooling/value.ts";',
				path: "modules/app/src/client.ts",
			},
			{ content: 'import "node:fs";', path: "script/task.ts" },
			{ content: 'import "node:fs";\nimport "./src/client.ts";', path: "modules/app/vitest.config.ts" },
			{ content: "export const value = 1;", path: "modules/app/src/tooling/value.ts" },
			{ content: 'import "../../scripts/task.ts";\nimport "../../tooling/task.ts";', path: "modules/app/src/client/app.ts" },
			{ content: 'import "node:fs";', path: "modules/app/scripts/task.ts" },
			{ content: 'import "node:fs";', path: "modules/app/tooling/task.ts" },
		]);
		expect((await findingsIn(importsRuntime, undefined, root)).map(({ subject }) => subject)).toEqual([
			"../../../script/task.ts",
			"../vitest.config.ts",
			"../../scripts/task.ts",
			"../../tooling/task.ts",
		]);
	});

	it.each([undefined, "", {}, { worker: "" }])("does not infer Node-only code from engines.node or an empty bin %j", async (bin) => {
		const root = seedTree([
			{ content: JSON.stringify({ bin, engines: { node: ">=24" } }), path: "package.json" },
			{ content: 'import "node:fs";', path: "src/legacy.ts" },
		]);
		expect(await findingsIn(importsRuntime, undefined, root)).toEqual([]);
	});
});
