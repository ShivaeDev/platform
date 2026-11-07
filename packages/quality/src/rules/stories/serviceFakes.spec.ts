import { expect } from "@effect/vitest";
import { adapterOnlyFakes } from "#rules/stories/adapterOnlyFakes.ts";
import { fakeRepository, fakeSpec } from "#test/fakeRepository.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const replacement of [
	'import { Layer } from "effect"; Layer.succeed(Orders, {});',
	'import { Layer } from "effect"; Layer.succeed(Orders)({ total: () => 2 });',
	'import { Layer, Effect } from "effect"; Layer.effect(Orders)(Effect.succeed({ total: () => 2 }));',
	'import { Effect } from "effect"; const replacement = { total: () => 2 }; Effect.provideService(Orders, replacement);',
	'import { Layer as Layers, Effect } from "effect"; Layers.effect(Orders, Effect.fail("unavailable"));',
	'import * as Layers from "effect/Layer"; Layers.sync(Orders, () => ({}));',
	'import { succeed } from "effect/Layer"; succeed(Orders, {});',
	'import { Effect } from "effect"; Effect.provideService(Orders, {});',
	'import { Effect } from "effect"; Effect.provideService(program, Orders, {});',
] as const) {
	ruleStory.it(
		`tests/adapter-only-fakes reports an owned service replaced by ${replacement}`,
		[repositoryHas(...fakeRepository, fakeSpec(`import { Orders } from "./published.ts";\n${replacement}`))],
		function* ({ check }) {
			const findings = yield* check(adapterOnlyFakes);

			expect(findings).toEqual([
				{
					file: "src/orders.spec.ts",
					line: 2,
					message: expect.stringContaining("Replaces owned code in src/orders.ts"),
				},
			]);
		},
	);
}

for (const source of [
	'import { Layer } from "effect"; import { Mail } from "./adapters/mail.ts"; Layer.succeed(Mail, {});',
	'import { Layer, FileSystem } from "effect"; Layer.succeed(FileSystem.FileSystem, {});',
	'import { Layer } from "effect"; import { defineService } from "@shivaedev/service/defineService.ts"; const Fixture = defineService({}); Layer.succeed(Fixture, {});',
	"const fixture = `Layer.succeed(Orders, {});`;",
] as const) {
	ruleStory.it(
		`tests/adapter-only-fakes accepts adapter services, outside services and test-owned fixtures: ${source}`,
		[repositoryHas(...fakeRepository, fakeSpec(source))],
		function* ({ check }) {
			expect(yield* check(adapterOnlyFakes)).toEqual([]);
		},
	);
}

ruleStory.it(
	"tests/adapter-only-fakes follows an imported test-support implementation that replaces an owned service",
	[
		repositoryHas(
			...fakeRepository,
			{ content: "export const fakeOrders = { total: () => 2 };", path: "src/test-support/fakeOrders.ts" },
			fakeSpec(
				'import { Orders } from "./orders.ts";\nimport { fakeOrders } from "./test-support/fakeOrders.ts";\nimport { Layer } from "effect";\nLayer.succeed(Orders, fakeOrders);',
			),
		),
	],
	function* ({ check }) {
		const findings = yield* check(adapterOnlyFakes);

		expect(findings).toEqual([{ file: "src/orders.spec.ts", line: 4, message: expect.stringContaining("src/orders.ts") }]);
	},
);
