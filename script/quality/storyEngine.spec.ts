import { expect } from "vitest";
import { storyEngine } from "@shivaedev/quality/rules/stories/engine.ts";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { kitFiles, prerequisiteFiles, spec } from "#quality-fixtures/storySpecFiles.ts";

ruleKit.it(
	"a traitless story that ignores its kit reports its line and both repairs",
	[repositoryHas(...kitFiles, spec('import { orders } from "#test/orders.ts";\norders.it("adds", [], () => { expect(add(1, 2)).toBe(3); });'))],
	function* ({ checks }) {
		const findings = yield* checks(storyEngine);
		expect(findings).toEqual([
			{
				file: "src/orders.spec.ts",
				line: 2,
				message: expect.stringContaining("Drive the engine through one of the kit's verbs or traits"),
			},
		]);
		expect(findings).toEqual([
			expect.objectContaining({ message: expect.stringContaining("orders.unit.spec.ts, which reaches no engine and mocks nothing") }),
		]);
	},
);

for (const [name, registration] of [
	["calls a verb", 'orders.it("places an order", [], function* ({ place }) { yield* place(); });'],
	["uses a trait", 'orders.it("places an order", [configured], () => { expect(add(1, 2)).toBe(3); });'],
	["uses only its test context", 'orders.it("has a context", [], function* (_, context) { expect(context.task.name).toBe("has a context"); });'],
	["reads its story", 'orders.it("reads the engine", [], function* ({ story }) { expect(story.engine).toBeDefined(); });'],
	["reads its verbs object", 'orders.it("places an order", [], function* (verbs) { yield* verbs.place(); });'],
	["renames a destructured verb", 'orders.it("places an order", [], function* ({ place: submit }) { yield* submit(); });'],
	["uses a verb in a nested callback", 'orders.it("places an order", [], ({ place }) => { return run(() => place()); });'],
	["passes a verb in a shorthand property", 'orders.it("places an order", [], ({ place }) => { run({ place }); });'],
	["uses a named body", 'function* body({ place }) { yield* place(); }\norders.it("places an order", [], body);'],
]) {
	ruleKit.it(
		`a story that ${name} passes`,
		[repositoryHas(...kitFiles, spec(`import { orders } from "#test/orders.ts";\n${registration}`))],
		function* ({ checks }) {
			expect(yield* checks(storyEngine)).toEqual([]);
		},
	);
}

for (const body of [
	"({ place }) => { expect(add(1, 2)).toBe(3); }",
	"({ place }) => { run((place) => place()); }",
	"({ place }) => { expect({ place: 3 }).toBeDefined(); }",
]) {
	ruleKit.it(
		`declaring or shadowing a verb does not reference the kit: ${body}`,
		[repositoryHas(...kitFiles, spec(`import { orders } from "#test/orders.ts";\norders.it("adds", [], ${body});`))],
		function* ({ checks }) {
			expect(yield* checks(storyEngine)).toEqual([expect.objectContaining({ file: "src/orders.spec.ts", line: 2 })]);
		},
	);
}

for (const directory of ["stories", "engine", "types", "quality", "optional"]) {
	ruleKit.it(
		`test-story prerequisite ${directory} may prove its kit lifecycle without using it`,
		[
			repositoryHas(
				...prerequisiteFiles,
				spec(
					'import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";\nconst orders = storyKit({});\norders.it("adds", [], () => { expect(add(1, 2)).toBe(3); });',
					`modules/${directory}/src/orders.spec.ts`,
				),
			),
		],
		function* ({ checks }) {
			expect(yield* checks(storyEngine)).toEqual([]);
		},
	);
}

for (const path of ["src/orders.unit.test.ts", "src/orders.typecheck.test.ts", "src/orders.ts"]) {
	ruleKit.it(
		`the engine rule leaves ${path} alone`,
		[
			repositoryHas(
				...kitFiles,
				spec('import { orders } from "#test/orders.ts";\norders.it("adds", [], () => { expect(add(1, 2)).toBe(3); });', path),
			),
		],
		function* ({ checks }) {
			expect(yield* checks(storyEngine)).toEqual([]);
		},
	);
}
