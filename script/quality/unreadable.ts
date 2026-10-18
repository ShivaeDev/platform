import { defineRule } from "@shivaedev/quality/rule.ts";
import { manifestFiles } from "./manifestFiles.ts";

export const unreadable = defineRule({
	check: async (inputs) =>
		(await manifestFiles(inputs)).flatMap(({ fields, path }) =>
			fields === undefined ? [{ file: path, message: "is not a readable JSON manifest." }] : [],
		),
	description: "Keep root and workspace manifests readable with dependency maps.",
	id: "manifests/unreadable",
});
