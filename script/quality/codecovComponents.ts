import { defineRule } from "@shivaedev/quality/rule.ts";
import { committedComponents, components } from "#codecov/components.ts";
import { manifestFiles } from "./manifestFiles.ts";

export const codecovComponents = defineRule({
	check: async (inputs) => {
		const packages = (await manifestFiles(inputs)).flatMap(({ fields, path }) =>
			path === "package.json" || fields?.name === undefined ? [] : [{ name: fields.name, root: path.slice(0, -"/package.json".length) }],
		);
		return committedComponents((await inputs.readText("codecov.yml")) ?? "") === components(packages)
			? []
			: [
					{
						file: "codecov.yml",
						message: "component_management does not list one component per workspace package. Run `pnpm codecov:components` and commit codecov.yml.",
					},
				];
	},
	description: "Keep one Codecov component per workspace package.",
	id: "codecov/components",
});
