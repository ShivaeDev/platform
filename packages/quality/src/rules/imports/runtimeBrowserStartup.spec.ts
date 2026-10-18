import { afterEach, expect, it, vi } from "vitest";
import type { Finding, SourceFile } from "#rule.ts";
import { importsRuntime } from "#rules/imports/runtime.ts";
import { CLI_EXIT } from "#test/cli.ts";
import { findingsIn } from "#test/imports.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

const browser = vi.hoisted(() => ({ check: vi.fn<(file: SourceFile) => readonly Finding[]>(() => []), loads: 0 }));

vi.mock("#imports/browserGlobals.ts", () => {
	browser.loads += 1;
	return { browserGlobals: browser.check };
});

afterEach(removeSeededTrees);

it("loads the browser checker only when the runtime policy has shared source to inspect", async () => {
	const node = seedTree([
		{ content: '{"bin":"./src/cli.ts"}', path: "package.json" },
		{ content: 'import "node:fs";', path: "src/cli.ts" },
	]);
	expect(await findingsIn(importsRuntime, undefined, node)).toEqual([]);
	expect(browser.loads).toBe(CLI_EXIT.passed);
	expect(browser.check).not.toHaveBeenCalled();
	const app = seedTree([
		{ content: "export const cli = 1;", path: "src/server/cli.ts" },
		{ content: "export const shared = 1;", path: "src/shared.ts" },
	]);
	expect(await findingsIn(importsRuntime, undefined, app)).toEqual([]);
	expect(browser.loads).toBe(CLI_EXIT.rejected);
	expect(browser.check.mock.calls.map(([file]) => file.path)).toEqual(["src/shared.ts"]);
});
