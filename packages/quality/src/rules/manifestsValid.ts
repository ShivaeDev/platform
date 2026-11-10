import { Effect } from "effect";
import { loadPackageManifests, manifestFiles } from "#manifestInventory.ts";
import { defineRule } from "#rule.ts";

export const manifestsValid = defineRule({
	check: (inputs) =>
		Effect.map(loadPackageManifests(inputs.readText, manifestFiles(inputs)), (failures) =>
			failures.map(({ path, message }) => ({ file: path, message })),
		),
	description: "Every package.json is valid JSON and decodes through PackageManifest before repository rules run.",
	id: "manifests/valid",
	registrable: false,
});
