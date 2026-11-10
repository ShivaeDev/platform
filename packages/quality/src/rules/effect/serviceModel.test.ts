import { expect } from "@effect/vitest";
import { serviceModel } from "#rules/effect/serviceModel.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { ruleCases } from "#test/ruleCases.ts";
import { modelFiles, serviceResolves } from "#test/serviceModelFiles.ts";

const repository = ruleCases.repository(effectResolves(), serviceResolves());

for (const [name, operation, inventory] of [
	["an untraced function", "() => Effect.void", "read"],
	["an untraced pipe body", "() => Effect.void.pipe(Effect.asVoid)", "read"],
	["an untraced factory return", "() => () => Effect.void", "read(state)"],
	["the wrong service span", 'Effect.fn("Other.read")(() => Effect.void)', "read"],
	["the wrong operation span", 'Effect.fn("Inventory.write")(() => Effect.void)', "read"],
] as const) {
	ruleCases.it(
		`service model rejects ${name} in the operation inventory`,
		[repository.has(...modelFiles("Effect.void", operation, inventory))],
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
	ruleCases.it(`service model accepts ${name}`, [repository.has(...modelFiles("Effect.void", operation, inventory))], function* ({ check }) {
		const findings = yield* check(serviceModel);

		expect(findings).toEqual([]);
	});
}

ruleCases.it(
	"service model keeps traced operations beside their service declaration",
	[
		repository.has(
			...modelFiles().map((file) =>
				file.path.endsWith("read.ts") ? { ...file, path: "src/read.ts" } : { ...file, content: file.content.replace('"./read.ts"', '"../read.ts"') },
			),
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceModel);

		expect(findings).toEqual([
			expect.objectContaining({
				message: "Keep the read operation export in a sibling file beside this service's service.ts, one operation per file.",
			}),
		]);
	},
);

ruleCases.it(
	"operation filenames may use their service folder as an export-name prefix",
	[
		repository.has(
			...modelFiles("Effect.void", 'Effect.fn("Inventory.readInventory")(() => Effect.void)', "readInventory").map((file) => ({
				...file,
				content: file.content
					.replace("import { read }", "import { readInventory }")
					.replace("read: readInventory", "readInventory")
					.replace("export const read =", "export const readInventory ="),
			})),
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceModel);

		expect(findings).toEqual([]);
	},
);

ruleCases.it(
	"each operation has its own file even when both spans are correct",
	[
		repository.has(
			...modelFiles().map((file) => ({
				...file,
				content: file.path.endsWith("read.ts")
					? `${file.content}\nexport const write = Effect.fn("Inventory.write")(() => Effect.void);`
					: file.content.replace("import { read }", "import { read, write }").replace("read: read", "read, write"),
			})),
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceModel);

		expect(findings).toEqual([
			expect.objectContaining({ message: "Keep one operation export per file beside service.ts. read.ts holds more than one operation." }),
			expect.objectContaining({ message: "Keep one operation export per file beside service.ts. read.ts holds more than one operation." }),
		]);
	},
);
