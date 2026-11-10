import { Effect } from "effect";
import { sortingOf } from "#adapters/manifestSorting.ts";
import { manifestFiles, manifestText } from "#manifestInventory.ts";
import { defineRule } from "#rule.ts";

export const manifestsSorted = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const findings = yield* Effect.forEach(
				manifestFiles(inputs),
				(file) =>
					Effect.gen(function* () {
						const text = yield* manifestText(inputs.readText, file);
						return text === undefined || sortingOf(text)._tag === "Sorted"
							? []
							: [{ file, message: "Keys are not in sort-package-json order. Run `quality fix`." }];
					}),
				{ concurrency: "unbounded" },
			);
			return findings.flat();
		}),
	description: "Every package.json in the repository keeps its keys in sort-package-json order. `quality fix` sorts them.",
	id: "manifests/sorted",
	registrable: false,
});
