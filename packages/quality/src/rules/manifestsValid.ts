import { Effect } from "effect";
import { loadPackageManifests, manifestFiles } from "#adapters/manifestInventory.ts";
import { runRuleEffect } from "#adapters/runRuleEffect.ts";
import { defineRule } from "#rule.ts";

export const manifestsValid = defineRule({
	check: (inputs) =>
		runRuleEffect(
			Effect.map(
				Effect.promise(() => loadPackageManifests(inputs.readText, manifestFiles(inputs))),
				(failures) => failures.map(({ path, message }) => ({ file: path, message })),
			),
		),
	description: "Every package.json is valid JSON and decodes through PackageManifest before repository rules run.",
	id: "manifests/valid",
	registrable: false,
});
