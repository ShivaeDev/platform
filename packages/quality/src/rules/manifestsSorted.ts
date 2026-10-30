import { manifestFiles, manifestText } from "#adapters/manifestInventory.ts";
import { sortingOf } from "#manifests/sorted.ts";
import { defineRule } from "#rule.ts";

export const manifestsSorted = defineRule({
	check: async (inputs) => {
		const findings = await Promise.all(
			manifestFiles(inputs).map(async (file) => {
				const text = await manifestText(inputs.readText, file);
				return text === undefined || sortingOf(text)._tag === "Sorted"
					? []
					: [{ file, message: "Keys are not in sort-package-json order. Run `quality fix`." }];
			}),
		);
		return findings.flat();
	},
	description: "Every package.json in the repository keeps its keys in sort-package-json order. `quality fix` sorts them.",
	id: "manifests/sorted",
	registrable: false,
});
