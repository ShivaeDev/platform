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

it.each([
	{ linked: false, sources: ["modules/app/src", "modules/kit/src"], workspace: "npm" },
	{ linked: false, sources: ["modules/app/src", "modules/kit/src"], workspace: "pnpm" },
	{ linked: true, sources: ["modules/app/src"], workspace: "npm" },
	{ linked: true, sources: ["modules/app/src"], workspace: "pnpm" },
] as const)(
	"discovers $workspace manifests outside selected sources $sources",
	({ linked, sources, workspace }) => {
		const root = manifestTree(
			[config(`{ sources: ${JSON.stringify(sources)} }`), { content: 'import "plain-kit";\nexport const app = 1;', path: "modules/app/src/app.ts" }],
			{ linked, workspace },
		);
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("error imports/manifest (1)");
		expect(result.stdout).toContain('Imports workspace package "plain-kit" without declaring it in modules/app/package.json');
	},
	30_000,
);

it("keeps each importing member's policy when only source folders are selected", () => {
	const root = manifestTree(
		[
			config('{ sources: ["modules/app/src", "modules/kit/src"] }'),
			{ content: 'import "plain-kit";', path: "modules/app/src/app.ts" },
			{ content: 'import "@acme/app";', path: "modules/kit/src/app.ts" },
			{ content: '{"name":"root","dependencies":{"@acme/app":"workspace:*","plain-kit":"workspace:*"}}', path: "package.json" },
		],
		{ declaration: "dependencies" },
	);
	const result = quality(root, "lint");
	expect(result.status).toBe(1);
	expect(result.stdout).toContain("error imports/manifest (1)");
	expect(result.stdout).toContain('Imports workspace package "@acme/app" without declaring it in modules/kit/package.json');
	expect(result.stdout).not.toContain('Imports workspace package "plain-kit" without declaring it');
}, 30_000);

it("keeps a member's development dependencies restricted to test code with an unselected target", () => {
	const root = manifestTree(
		[
			config('{ sources: ["modules/app/src"] }'),
			{ content: 'import "plain-kit";', path: "modules/app/src/app.ts" },
			{ content: 'import "plain-kit";', path: "modules/app/src/app.test.ts" },
			{ content: '{"name":"root","dependencies":{"plain-kit":"workspace:*"}}', path: "package.json" },
		],
		{ declaration: "devDependencies" },
	);
	const result = quality(root, "lint");
	expect(result.status).toBe(1);
	expect(result.stdout).toContain("error imports/manifest (1)");
	expect(result.stdout).toContain('Imports workspace package "plain-kit" without declaring it in modules/app/package.json');
	expect(result.stdout).toContain("devDependencies are only available to tests, test support and tooling.");
}, 30_000);
