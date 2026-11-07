import { createRequire } from "node:module";
import { dirname } from "node:path";
import { repositoryLinks } from "#test/ruleStory.ts";

export function hostServicesResolve() {
	const require = createRequire(import.meta.url);
	return ["@types/node", "@effect/platform-node", "@effect/platform-node-shared"].map((name) =>
		repositoryLinks(`node_modules/${name}`, dirname(require.resolve(`${name}/package.json`))),
	);
}
