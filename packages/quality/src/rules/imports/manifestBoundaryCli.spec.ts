import { afterEach, expect, it } from "vitest";
import { quality } from "#test/cli.ts";
import { manifestTree } from "#test/manifestTree.ts";
import { config, removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

it("enables manifest boundaries by default on the CLI without import configuration or leaf fences", () => {
	const root = manifestTree([
		config('{ sources: ["modules"] }'),
		{ content: 'import "plain-kit";\nexport const app = 1;', path: "modules/app/src/app.ts" },
	]);
	const result = quality(root, "lint");
	expect(result.status).toBe(1);
	expect(result.stdout).toContain("error imports/manifest (1)");
	expect(result.stdout).toContain('Imports workspace package "plain-kit" without declaring it in modules/app/package.json');
}, 30_000);
