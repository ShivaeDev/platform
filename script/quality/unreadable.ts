import { Effect } from "effect";
import { defineRule } from "@shivaedev/quality/rule.ts";
import { manifestFiles } from "#quality/manifestFiles.ts";

export const unreadable = defineRule({
	check: (inputs) =>
		Effect.map(manifestFiles(inputs), (manifests) =>
			manifests.flatMap(({ fields, path }) => (fields === undefined ? [{ file: path, message: "is not a readable JSON manifest." }] : [])),
		),
	description: "Keep root and workspace manifests readable with dependency maps.",
	id: "manifests/unreadable",
});
