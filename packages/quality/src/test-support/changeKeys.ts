import { mkdirSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { SeedFile } from "#testing/adapters/tree.ts";
import { ruleStory } from "./ruleStory.ts";

export function changeKeysResolve() {
	return ruleStory.trait("repository", "the changes and SQL packages resolve with their real declarations", (engine) => {
		for (const name of ["@shivaedev/changes", "@shivaedev/sql"]) {
			const link = join(engine.root, "node_modules", name);
			mkdirSync(dirname(link), { recursive: true });
			symlinkSync(dirname(createRequire(import.meta.url).resolve(`${name}/package.json`)), link, "dir");
		}
	});
}

export function changeKeyConsumer(code: string): SeedFile {
	return {
		content: [
			'import { Effect } from "effect";',
			'import * as Reactivity from "effect/reactivity/Reactivity";',
			'import { Reactivity as Native } from "effect/reactivity";',
			'import { invalidate as refresh } from "effect/reactivity/Reactivity";',
			'import { invalidateOnCommit as commit } from "@shivaedev/sql/transact.ts";',
			'import { collectionInvalidationKeys, invalidationKeys, readKeys, recordKey } from "@shivaedev/changes/keys.ts";',
			'import { orders } from "./orders.ts";',
			code,
		].join("\n"),
		path: "src/consumer.ts",
	};
}

export const orderKeys: SeedFile = {
	content:
		'import { Schema } from "effect"; import { collection } from "@shivaedev/changes/keys.ts"; export const orders = collection("orders", Schema.Number, { owner: Schema.String });',
	path: "src/orders.ts",
};
