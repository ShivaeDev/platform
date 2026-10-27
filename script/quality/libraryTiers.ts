import { defineRule } from "@shivaedev/quality/rule.ts";
import { manifestFiles } from "./manifestFiles.ts";

const PLATFORM = "@shivaedev/platform";

const DEPENDENCY_KEYS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;

const APPLICATION = /^examples\//u;

export const libraryTiers = defineRule({
	check: async (inputs) =>
		(await manifestFiles(inputs))
			.filter(({ fields, path }) => !APPLICATION.test(path) && fields?.name !== PLATFORM)
			.flatMap(({ fields, path }) =>
				DEPENDENCY_KEYS.filter((key) => fields?.[key]?.[PLATFORM] !== undefined).map((key) => ({
					file: path,
					message: `Lists "${PLATFORM}" in ${key}. Only applications depend on the platform shell; a library or published application declares each piece it imports, such as "@shivaedev/sql", directly.`,
					subject: key,
				})),
			),
	description: `Only applications under examples/ depend on ${PLATFORM}; libraries, tools and published applications declare their pieces directly.`,
	id: "manifests/library-tiers",
});
