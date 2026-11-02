import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { globalRetries } from "#rules/stories/globalRetries.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { kitFiles, spec } from "#test/storySpecFiles.ts";

for (const registration of [
	'it("works", { retry: 2 }, () => {});',
	'test("works", () => {}, { retry: 1 });',
	'describe("orders", { retry: 2 }, () => {});',
	'suite("orders", () => {}, { retry: 2 });',
	'it.only("works", { retry: 0 }, () => {});',
	'it.skip("works", { "retry": 1 }, () => {});',
	'it.runIf(true)("works", { ["retry"]: 1 }, () => {});',
	'it.each([1, 2])("works %s", { retry: 1 }, () => {});',
	`it.each\`value | expected\n\${1} | \${1}\`("works", { retry: 1 }, () => {});`,
	'describe.each([1, 2])("orders %s", { retry: 1 }, () => {});',
	'const register = test; register("works", { retry: 1 }, () => {});',
	'const retry = 1; it("works", { retry }, () => {});',
	'const options = { retry: 1 }; it("works", options, () => {});',
	'const options = { retry: 1 }; it("works", { ...options }, () => {});',
	'it("works", true ? { retry: 1 } : {}, () => {});',
	'describe("orders", () => { it("works", { retry: 1 }, () => {}); });',
]) {
	ruleStory.it(
		`tests/global-retries reports the registration and repair for ${registration}`,
		[repositoryHas(spec(`import { it, test, describe, suite } from "vitest";\n${registration}`))],
		function* ({ check, locations, messages }) {
			yield* check(globalRetries);

			yield* outcomes([
				["registration", () => locations(), ["src/orders.spec.ts:2"]],
				["repair", () => messages(), [expect.stringContaining("Remove the retry option: retries are global only and recorded by vitest-rerun")]],
			]);
		},
	);
}

for (const registration of [
	'orders.it("works", [], function* () {}, { retry: 1 });',
	'orders.it.only("works", [], function* () {}, { retry: 2 });',
	'orders.it.runIf(true)("works", [], function* () {}, { retry: 1 });',
	'orders["it"]("works", [], function* () {}, { retry: 1 });',
	'const register = orders.it; register("works", [], function* () {}, { retry: 1 });',
]) {
	ruleStory.it(
		`tests/global-retries follows the imported story kit for ${registration}`,
		[repositoryHas(...kitFiles, spec(`import { orders } from "#test/orders.ts";\n${registration}`))],
		function* ({ check, locations }) {
			yield* check(globalRetries);

			expect(yield* locations()).toEqual(["src/orders.spec.ts:2"]);
		},
	);
}

for (const [imports, registration] of [
	['import { test as register } from "vitest";', 'register("works", { retry: 1 }, () => {});'],
	['import * as runner from "vitest";', 'runner.test("works", { retry: 1 }, () => {});'],
	['import { it } from "@effect/vitest";', 'it.effect("works", () => Effect.void, { retry: 1 });'],
	['import { it } from "@effect/vitest";', 'it.layer(layer)("orders", { retry: 1 }, (it) => {});'],
	['import { it } from "@shivaedev/test/it.ts";', 'it.effect("works", function* () {}, { retry: 1 });'],
	['import { it } from "@shivaedev/test/adapters/it.ts";', 'it.effect("works", function* () {}, { retry: 1 });'],
	[
		'import { makeEffectIt } from "@shivaedev/test/makeEffectIt.ts";',
		'const { effectApp } = makeEffectIt({}); effectApp("works", function* () {}, { retry: 1 });',
	],
	[
		'import { makeEffectIt } from "@shivaedev/test/adapters/makeEffectIt.ts";',
		'const { effectApp } = makeEffectIt({}); effectApp("works", function* () {}, { retry: 1 });',
	],
]) {
	ruleStory.it(
		`tests/global-retries traces the registrar in ${imports} ${registration}`,
		[repositoryHas(spec(`${imports}\n${registration}`, "src/test-support/registrations.ts"))],
		function* ({ check, locations }) {
			yield* check(globalRetries);

			expect(yield* locations()).toEqual(["src/test-support/registrations.ts:2"]);
		},
	);
}

ruleStory.it(
	"tests/global-retries accepts runner reruns, Effect schedules, product retry data and registrations without retry",
	[
		repositoryHas(
			...kitFiles,
			{ content: 'import * as VitestNode from "vitest/node"; VitestNode.createVitest({ retry: 0, watch: false });', path: "src/runAttempt.ts" },
			{ content: 'import { defineConfig } from "vitest/config"; export default defineConfig({ test: { retry: 2 } });', path: "vitest.config.ts" },
			{
				content: 'import { rerun } from "@shivaedev/vitest-rerun/rerun.ts"; rerun({ cwd: ".", outputDir: ".ci", reruns: 2, vitestArgs: [] });',
				path: "src/run.ts",
			},
			{
				content: 'import { Effect, Schedule } from "effect"; export const work = Effect.retry(Effect.fail("offline"), Schedule.recurs(2));',
				path: "src/work.ts",
			},
			spec(`import { it, test, describe } from "vitest";
import { orders } from "#test/orders.ts";
it("works", { timeout: 1000 }, () => { const data = { retry: 1 }; });
test("works", () => {}, 1000);
describe("orders", { concurrent: true }, () => {});
orders.it("works", [], function* () {}, { timeout: 1000 });
it.each([{ retry: 1 }])("works %s", () => {});
test.extend("data", { retry: 1 }, () => {});
const other = { it() {}, test() {}, describe() {} };
other.it("works", { retry: 1 }, () => {});
other.describe("orders", { retry: 1 }, () => {});`),
		),
	],
	function* ({ check, findings }) {
		yield* check(globalRetries);

		expect(yield* findings()).toEqual([]);
	},
);
