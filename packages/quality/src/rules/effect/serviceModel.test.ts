import { expect } from "@effect/vitest";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { modelFiles, serviceResolves } from "#test/serviceModelFiles.ts";
import { serviceModel } from "./serviceModel.ts";

for (const [name, operation, inventory] of [
	["an untraced function", "() => Effect.void", "read"],
	["an untraced pipe body", "() => Effect.void.pipe(Effect.asVoid)", "read"],
	["an untraced factory return", "() => () => Effect.void", "read(state)"],
	["the wrong service span", 'Effect.fn("Other.read")(() => Effect.void)', "read"],
	["the wrong operation span", 'Effect.fn("Inventory.write")(() => Effect.void)', "read"],
] as const) {
	ruleStory.it(
		`service model rejects ${name} in the operation inventory`,
		[effectResolves(), serviceResolves(), repositoryHas(...modelFiles("Effect.void", operation, inventory))],
		function* ({ check }) {
			const findings = yield* check(serviceModel);

			expect(findings).toEqual([
				expect.objectContaining({
					message: expect.stringContaining('Export this operation as Effect.fn("Inventory.read")'),
				}),
			]);
		},
	);
}

for (const [name, operation, inventory] of [
	[
		"a branched state factory",
		'(state: unknown) => state ? Effect.fn("Inventory.read")(() => Effect.void) : Effect.fn("Inventory.read")(() => Effect.void)',
		"read(state)",
	],
	["a traced operation", 'Effect.fn("Inventory.read")(() => Effect.void)', "read"],
	["a traced state factory", '() => Effect.fn("Inventory.read")(() => Effect.void.pipe(Effect.asVoid))', "read(state)"],
] as const) {
	ruleStory.it(
		`service model accepts ${name}`,
		[effectResolves(), serviceResolves(), repositoryHas(...modelFiles("Effect.void", operation, inventory))],
		function* ({ check }) {
			const findings = yield* check(serviceModel);

			expect(findings).toEqual([]);
		},
	);
}

ruleStory.it(
	"service model keeps traced operations beside their service declaration",
	[
		effectResolves(),
		serviceResolves(),
		repositoryHas(
			...modelFiles().map((file) =>
				file.path.endsWith("read.ts") ? { ...file, path: "src/read.ts" } : { ...file, content: file.content.replace('"./read.ts"', '"../read.ts"') },
			),
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceModel);

		expect(findings).toEqual([
			expect.objectContaining({ message: "Keep the read operation export in read.ts beside this service's service.ts, one operation per file." }),
		]);
	},
);
