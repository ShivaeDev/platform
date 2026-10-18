import { afterEach, expect, it } from "vitest";
import { storySpecs } from "#rules/stories/specs.ts";
import { findingsIn } from "#test/imports.ts";
import { kitFiles, prerequisiteFiles, spec } from "#test/storySpecFiles.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

it("accepts a story declared through the package's re-exported kit", async () => {
	const root = seedTree([...kitFiles, spec('import { app as orders } from "#test/index.ts"; orders.it("saves an order", []);')]);

	expect(await findingsIn(storySpecs, undefined, root)).toEqual([]);
});

it("reports a plain Vitest file once and explains the repair", async () => {
	const root = seedTree([spec('import { it, test } from "vitest";\nit("adds", () => {});\ntest("subtracts", () => {});')]);

	expect(await findingsIn(storySpecs, undefined, root)).toEqual([
		{
			file: "src/orders.spec.ts",
			line: 2,
			message: expect.stringContaining("declare every test through the kit's it"),
		},
	]);
});

it("reports plain declarations even alongside a story", async () => {
	const root = seedTree([
		...kitFiles,
		spec('import { orders } from "#test/orders.ts"; import { it as plain } from "vitest"; orders.it("story", []); plain("plain", () => {});'),
	]);

	expect(await findingsIn(storySpecs, undefined, root)).toHaveLength(1);
});

it.each(["it", "test"])("reports destructured Vitest %s alongside a story", async (name) => {
	const root = seedTree([
		...kitFiles,
		spec(
			[
				'import * as v from "vitest";',
				'import { orders } from "#test/orders.ts";',
				`const { ${name}: ordinary } = v;`,
				'ordinary("plain", () => {});',
				'orders.it("story", [], () => {});',
			].join("\n"),
		),
	]);
	expect(await findingsIn(storySpecs, undefined, root)).toEqual([expect.objectContaining({ file: "src/orders.spec.ts", line: 4 })]);
});

it("tracks a destructured registrar through a namespace alias with an opaque body", async () => {
	const root = seedTree([
		...kitFiles,
		spec(
			[
				'import * as v from "vitest";',
				'import { orders } from "#test/orders.ts";',
				"const runtime = v; const { test: ordinary } = runtime;",
				"declare const body: () => void;",
				'ordinary("plain", body);',
				'orders.it("story", [], body);',
			].join("\n"),
		),
	]);
	expect(await findingsIn(storySpecs, undefined, root)).toEqual([expect.objectContaining({ file: "src/orders.spec.ts", line: 5 })]);
});

it("preserves an unrecognized registration alongside a story inside a suite", async () => {
	const root = seedTree([
		...kitFiles,
		spec(
			[
				'import { describe as group } from "vitest";',
				'import { orders } from "#test/orders.ts";',
				'group("orders", () => {',
				'  orders.it("story", [], () => {});',
				'  scenario("plain", () => {});',
				"});",
			].join("\n"),
		),
	]);
	expect(await findingsIn(storySpecs, undefined, root)).toEqual([expect.objectContaining({ file: "src/orders.spec.ts", line: 5 })]);
});

it("reports a custom registration with a named callback inside a suite", async () => {
	const root = seedTree([
		spec(['import { describe } from "vitest";', "function body() {}", 'describe("orders", () => { scenario("plain", body); });'].join("\n")),
	]);
	expect(await findingsIn(storySpecs, undefined, root)).toEqual([expect.objectContaining({ file: "src/orders.spec.ts", line: 3 })]);
});

it("accepts stories in a destructured suite and ignores callbacks inside their bodies", async () => {
	const root = seedTree([
		...kitFiles,
		spec(
			[
				'import * as v from "vitest";',
				'import { orders } from "#test/orders.ts";',
				"const { describe: group } = v;",
				'group("orders", () => {',
				'  orders.it("story", [], () => { engine.on("changed", () => {}); });',
				"});",
			].join("\n"),
		),
	]);
	expect(await findingsIn(storySpecs, undefined, root)).toEqual([]);
});

it("does not accept an unrelated object's it as a story kit", async () => {
	const root = seedTree([spec('import { storyKit } from "@shivaedev/test-story/storyKit.ts"; const orders = { it() {} }; orders.it("plain", []);')]);

	expect(await findingsIn(storySpecs, undefined, root)).toHaveLength(1);
});

it("leaves test-result inspection inside a story alone while reporting imported Vitest registrations", async () => {
	const inspection = [
		'import { orders } from "#test/orders.ts";',
		'orders.it("workers", [], ({ results }) => {',
		"  results.flatMap((test) => test.annotations());",
		"  for (const test of results) { test.result(); }",
		"});",
	].join("\n");
	const root = seedTree([
		...kitFiles,
		spec(inspection, "src/inspection.spec.ts"),
		spec(`${inspection}\nimport { test } from "vitest";\norders.it("nested", [], () => { test("plain", () => {}); });`, "src/plain.spec.ts"),
	]);

	expect(await findingsIn(storySpecs, undefined, root)).toEqual([expect.objectContaining({ file: "src/plain.spec.ts", line: 7 })]);
});

it("leaves test-named files with no test declarations alone", async () => {
	const root = seedTree([spec("String(0); String(1); const example = 'it()'; /a/.test(example);")]);
	expect(await findingsIn(storySpecs, undefined, root)).toEqual([]);
});

it("reports tests declared through a custom harness without a story kit", async () => {
	const root = seedTree([spec('import { scenario } from "./test-support/harness.ts"; scenario("plain", function* () {});')]);
	expect(await findingsIn(storySpecs, undefined, root)).toHaveLength(1);
});

it("follows a local kit, a namespace factory and a destructured registrar", async () => {
	const root = seedTree([
		spec(
			'import * as stories from "@shivaedev/test-story/storyKit.ts"; const app = stories.storyKit({}); const { it: scenario } = app; scenario("story", []);',
		),
	]);

	expect(await findingsIn(storySpecs, undefined, root)).toEqual([]);
});

it("follows conditional registrars and kit extensions", async () => {
	const root = seedTree([
		...kitFiles,
		{
			content: 'import { orders } from "./orders.ts"; export const app = { ...orders, it: orders.it.runIf(true) };',
			path: "src/test-support/conditional.ts",
		},
		spec('import { app } from "#test/conditional.ts"; const scenario = app.it; scenario("story", []); app.it.skipIf(false)("another story", []);'),
	]);

	expect(await findingsIn(storySpecs, undefined, root)).toEqual([]);
});

it("reports Vitest modifiers, renamed and namespace imports, globals and Effect testers", async () => {
	const root = seedTree([
		spec('import { test as scenario } from "vitest"; scenario.each([1])("plain", () => {});', "src/renamed.test.ts"),
		spec('import * as v from "vitest"; v.test.skip("plain", () => {});', "src/namespace.test.ts"),
		spec('it.each([1])("plain", () => {});', "src/global.test.ts"),
		spec('import { it } from "@effect/vitest"; it.effect("plain", function* () {});', "src/effect.test.ts"),
		spec('const it = makeDatabaseIt({}); const effectDB = it.effectDB; effectDB("plain", function* () {});', "src/custom.spec.ts"),
	]);

	expect((await findingsIn(storySpecs, undefined, root)).map((finding) => finding.file)).toEqual([
		"src/custom.spec.ts",
		"src/effect.test.ts",
		"src/global.test.ts",
		"src/namespace.test.ts",
		"src/renamed.test.ts",
	]);
});

it("uses all of Quality's test extensions and modifiers", async () => {
	const root = seedTree([
		...["test.ts", "spec.ts", "slow.test.ts", "dom.spec.tsx", "test.mts", "spec.cts", "test.js", "spec.jsx", "test.mjs", "spec.cjs"].map((suffix) =>
			spec('test("plain", () => {});', `src/orders.${suffix}`),
		),
	]);

	expect(await findingsIn(storySpecs, undefined, root)).toHaveLength(10);
});

it("exempts typecheck tests and leaves source files, regex calls and strings alone", async () => {
	const root = seedTree([
		...kitFiles,
		spec('import { test } from "vitest"; test("type only", () => {});', "src/orders.typecheck.test.ts"),
		spec('it("not a spec", () => {});', "src/orders.ts"),
		spec('import { orders } from "#test/orders.ts"; orders.it("story", [], () => { const text = "it()"; /a/.test(text); });'),
	]);

	expect(await findingsIn(storySpecs, undefined, root)).toEqual([]);
});

it("exempts the test-story workspace package by manifest name", async () => {
	const root = seedTree([
		{ content: '{"workspaces":["packages/*"]}', path: "package.json" },
		{ content: '{"name":"@shivaedev/test-story"}', path: "packages/story-runtime/package.json" },
		spec('import { it } from "vitest"; it("runtime", () => {});', "packages/story-runtime/src/runtime.test.ts"),
		spec('import { it } from "vitest"; it("ordinary package", () => {});', "src/orders.test.ts"),
	]);

	expect((await findingsIn(storySpecs, undefined, root)).map((finding) => finding.file)).toEqual(["src/orders.test.ts"]);
});

it("exempts test-story's runtime tests when it is the repository root", async () => {
	const root = seedTree([
		{ content: '{"name":"@shivaedev/test-story"}', path: "package.json" },
		spec('import { it } from "vitest"; it("runtime", () => {});'),
	]);

	expect(await findingsIn(storySpecs, undefined, root)).toEqual([]);
});

it("derives transitive exemptions from every workspace dependency kind and terminates on cycles", async () => {
	const root = seedTree([
		...prerequisiteFiles,
		...["stories", "engine", "types", "quality", "optional", "app", "unrelated"].map((directory) =>
			spec('import { it } from "vitest"; it("plain", () => {});', `modules/${directory}/src/engine.test.ts`),
		),
	]);
	expect((await findingsIn(storySpecs, undefined, root)).map((finding) => finding.file)).toEqual([
		"modules/app/src/engine.test.ts",
		"modules/unrelated/src/engine.test.ts",
	]);
});
