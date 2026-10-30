import { manifestEntry, manifestFiles } from "#adapters/manifestInventory.ts";
import { defineRule, type Finding } from "#rule.ts";
import { itemsOf, type Json, member, parseJsonc } from "#rules/suppressions/biome/json.ts";

const CONDITION = "source";

function misplaced(path: string, field: string, value: unknown, node: Json | undefined): readonly Finding[] {
	const conditions = typeof value === "object" && value !== null && !Array.isArray(value) ? Object.entries(value) : [];
	const first = conditions[0]?.[0];
	const own: readonly Finding[] =
		first === CONDITION || !conditions.some(([key]) => key === CONDITION)
			? []
			: [
					{
						file: path,
						line: node?.line,
						message: `Lists the "${CONDITION}" condition after "${first}" in ${field}. TypeScript takes the first condition that matches, so once built output exists it reads that instead of the sources the "${CONDITION}" condition names. Move "${CONDITION}" to the top of this condition block.`,
						subject: field,
					},
				];
	const nested = conditions.map(([key, child]) => misplaced(path, field, child, member(node, key)));
	const items = Array.isArray(value) ? value.flatMap((child: unknown, index) => misplaced(path, field, child, itemsOf(node)[index])) : [];
	return [...own, ...nested.flat(), ...items];
}

export const manifestsSourceFirst = defineRule({
	check: async (inputs) => {
		const findings = await Promise.all(
			manifestFiles(inputs).map(async (path) => {
				const entry = await manifestEntry(inputs.readText, path);
				if (entry === undefined) {
					return [];
				}
				const { manifest, text } = entry;
				const parsed = parseJsonc(path, text);
				const location = parsed._tag === "Parsed" ? parsed.json : undefined;
				return ["exports", "imports"].flatMap((field) =>
					misplaced(path, field, field === "exports" ? manifest.exports : manifest.imports, member(location, field)),
				);
			}),
		);
		return findings.flat();
	},
	description:
		'Every package.json condition block that names the "source" condition lists it first in exports and imports, so TypeScript reads the sources whether or not built output exists.',
	id: "manifests/source-first",
	registrable: false,
});
