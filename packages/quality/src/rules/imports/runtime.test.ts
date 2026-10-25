import { afterEach, describe, expect, it } from "vitest";
import { fence } from "#imports/fence.ts";
import { external, folders, modules } from "#imports/fences/selectors.ts";
import { importFences } from "#rules/imports/fences.ts";
import { importsRuntime } from "#rules/imports/runtime.ts";
import { quality } from "#test/cli.ts";
import { findingsIn, linkWorkspace, scanned } from "#test/imports.ts";
import { runtimeFolders } from "#test/runtimeFolders.ts";
import { config, defaultTree, removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("folder runtime boundaries", () => {
	it("rejects client-to-server and shared-to-runtime imports, including type imports, re-exports and missing targets", async () => {
		const root = seedTree([
			{ content: 'import "../server/db.ts";\nimport type { Db } from "../server/missing.ts";', path: "src/client/app.ts" },
			{ content: 'export { db } from "./server/db.ts";\nexport * from "./client/app.ts";', path: "src/shared.ts" },
			{ content: "export const db = 1;", path: "src/server/db.ts" },
		]);
		expect((await findingsIn(importsRuntime, undefined, root)).map(({ file, line, subject }) => ({ file, line, subject }))).toEqual([
			{ file: "src/client/app.ts", line: 1, subject: "../server/db.ts" },
			{ file: "src/client/app.ts", line: 2, subject: "../server/missing.ts" },
			{ file: "src/shared.ts", line: 1, subject: "./server/db.ts" },
			{ file: "src/shared.ts", line: 2, subject: "./client/app.ts" },
		]);
	});

	it("allows same-runtime imports and either runtime importing shared code", async () => {
		const root = seedTree([
			{ content: 'import "./view.ts";\nimport "../values.ts";\nwindow.alert("hi");', path: "src/client/app.ts" },
			{ content: "export const view = 1;", path: "src/client/view.ts" },
			{ content: 'import "./db.ts";\nimport "../values.ts";\nimport "node:fs";', path: "src/server/app.ts" },
			{ content: "export const db = 1;", path: "src/server/db.ts" },
			{ content: "export const value = 1;", path: "src/values.ts" },
		]);
		expect(await findingsIn(importsRuntime, undefined, root)).toEqual([]);
	});

	it.each(["node:fs", "fs/promises", "node:async_hooks"])("rejects the Node builtin %s in client and shared code", async (specifier) => {
		const root = seedTree([
			{ content: `import "${specifier}";`, path: "src/client/app.ts" },
			{ content: `export const load = () => import("${specifier}");`, path: "lib/load.ts" },
			{ content: `const fs = require("${specifier}");`, path: "src/load.ts" },
		]);
		expect(await findingsIn(importsRuntime, undefined, root)).toHaveLength(3);
	});

	it("discovers adoption independently of sources and keeps workspace owners separate", async () => {
		const root = seedTree([
			{ content: '{"workspaces":["modules/*"]}', path: "package.json" },
			{ content: '{"name":"app"}', path: "modules/app/package.json" },
			{ content: '{"name":"legacy"}', path: "modules/legacy/package.json" },
			{ content: 'import "node:fs";\nwindow.alert("hi");', path: "modules/app/src/shared.ts" },
			{ content: 'import "node:fs";\nwindow.alert("hi");', path: "modules/legacy/src/app.ts" },
			{ content: 'import "node:fs";', path: "script/task.ts" },
		]);
		runtimeFolders(root, "modules/app/src/server");
		const findings = await findingsIn(importsRuntime, undefined, root);
		expect(findings).toHaveLength(2);
		expect(findings.every(({ file }) => file === "modules/app/src/shared.ts")).toBe(true);
	});

	it("uses resolved package aliases across members and unselected targets", async () => {
		const root = seedTree([
			{ content: '{"workspaces":["modules/*"]}', path: "package.json" },
			{ content: '{"name":"app","imports":{"#db":"service/db.ts"}}', path: "modules/app/package.json" },
			{ content: '{"name":"service","exports":{"./db.ts":"./src/server/db.ts"}}', path: "modules/service/package.json" },
			{ content: 'import "#db";', path: "modules/app/src/client/app.ts" },
			{ content: "export const db = 1;", path: "modules/service/src/server/db.ts" },
		]);
		linkWorkspace(root, "service", "modules/service");
		const inputs = await scanned(root);
		const configured = await importsRuntime.configure(undefined);
		expect(configured._tag).toBe("Ready");
		if (configured._tag !== "Ready") {
			throw new Error("runtime rule must configure without options");
		}
		const sources = inputs.sources.filter(({ path }) => path.startsWith("modules/app/"));
		expect(await configured.check({ ...inputs, files: sources.map(({ path }) => path), sources })).toEqual([
			expect.objectContaining({ file: "modules/app/src/client/app.ts", subject: "#db" }),
		]);
	});

	it("retains explicit fences in packages with and without runtime folders", async () => {
		const policy = fence("legacy-browser-stays-off-disk")
			.because("The existing browser code needs no Node.")
			.from(folders("src/browser"))
			.mayNotImport(modules("node:fs"))
			.demonstratedBy({ illegal: ["src/browser/app.ts", external("node:fs")], legal: ["src/browser/app.ts", external("effect")] });
		const root = seedTree([{ content: 'import "node:fs";', path: "src/browser/app.ts" }]);
		expect(await findingsIn(importsRuntime, undefined, root)).toEqual([]);
		expect(await findingsIn(importFences, { fences: [policy] }, root)).toHaveLength(1);
		runtimeFolders(root, "src/client");
		expect(await findingsIn(importsRuntime, undefined, root)).toHaveLength(1);
		expect(await findingsIn(importFences, { fences: [policy] }, root)).toHaveLength(1);
	});

	it("leaves test files and test support outside the shipped runtime policy", async () => {
		const root = seedTree([
			{ content: "export const app = 1;", path: "src/client/app.ts" },
			{ content: 'import "node:fs";\ndocument.title = "test";\nimport "./client/app.ts";', path: "src/app.test.ts" },
			{ content: 'import "node:fs";\nwindow.alert("test");', path: "src/test-support/setup.ts" },
		]);
		expect(await findingsIn(importsRuntime, undefined, root)).toEqual([]);
	});

	it("runs on the real CLI without runtime configuration or explicit fences", () => {
		const root = defaultTree(config('{ sources: ["src/values.ts"] }'), {
			content: 'import "node:fs";\nexport const values = window.location;',
			path: "src/values.ts",
		});
		runtimeFolders(root, "src/server");
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("error imports/runtime (2)");
		expect(result.stdout).toContain("Shared code imports Node built-in");
		expect(result.stdout).toContain('Shared code uses browser global "window"');
	});
});
