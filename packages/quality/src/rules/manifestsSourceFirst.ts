import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { Effect } from "effect";
import { manifestsIn } from "#manifests/sorted.ts";
import { defineRule, type Finding } from "#rule.ts";
import { entriesOf, itemsOf, type Json, member, parseJsonc } from "#rules/suppressions/biome/json.ts";

const CONDITION = "source";

function misplaced(path: string, field: string, node: Json): readonly Finding[] {
	const conditions = entriesOf(node);
	const first = conditions[0]?.[0];
	const own: readonly Finding[] =
		first === CONDITION || !conditions.some(([key]) => key === CONDITION)
			? []
			: [
					{
						file: path,
						line: node.line,
						message: `Lists the "${CONDITION}" condition after "${first}" in ${field}. TypeScript takes the first condition that matches, so once built output exists it reads that instead of the sources the "${CONDITION}" condition names. Move "${CONDITION}" to the top of this condition block.`,
						subject: field,
					},
				];
	const nested = [...conditions.map(([, value]) => value), ...itemsOf(node)];
	return [...own, ...nested.flatMap((value) => misplaced(path, field, value))];
}

function findingsIn(path: string, text: string): readonly Finding[] {
	const parsed = parseJsonc(path, text);
	if (parsed._tag !== "Parsed") {
		return [];
	}
	return ["exports", "imports"].flatMap((field) => {
		const map = member(parsed.json, field);
		return map === undefined ? [] : misplaced(path, field, map);
	});
}

export const manifestsSourceFirst = defineRule({
	check: async ({ readText, root }) => {
		const manifests = await Effect.runPromise(manifestsIn(root).pipe(Effect.provide(NodeFileSystem.layer)));
		const texts = await Promise.all(manifests.map(async (path) => ({ path, text: (await readText(path)) ?? "" })));
		return texts.filter(({ text }) => text.includes(`"${CONDITION}"`)).flatMap(({ path, text }) => findingsIn(path, text));
	},
	description:
		'Every package.json condition block that names the "source" condition lists it first in exports and imports, so TypeScript reads the sources whether or not built output exists.',
	id: "manifests/source-first",
	registrable: false,
});
