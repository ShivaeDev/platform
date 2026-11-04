import { Effect } from "effect";
import { postgresTestEnvironment } from "#lib/postgresTestEnvironment.ts";
import type { Entry } from "#package-check/exports.ts";
import { command } from "#package-check/io.ts";

export const checkRuntimeExports = Effect.fn("Packed.checkRuntimeExports")(function* (consumer: string, entries: readonly Entry[]) {
	const environment = yield* postgresTestEnvironment;
	yield* command(consumer, "env", [
		"-u",
		"NODE_OPTIONS",
		...Object.entries(environment).map(([name, value]) => `${name}=${value}`),
		"node",
		"--conditions=source",
		"--input-type=module",
		"--eval",
		[
			'import assert from "node:assert/strict";',
			...entries
				.filter((entry) => !entry.json)
				.map(({ specifier }) => {
					const name = JSON.stringify(specifier);
					return `assert.match(import.meta.resolve(${name}), /\\/dist\\/.*\\.js$/, ${name});\nawait import(${name});`;
				}),
		].join("\n"),
	]);
});
