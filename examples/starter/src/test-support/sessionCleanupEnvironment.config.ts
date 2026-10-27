import { createRequire } from "node:module";
import { setTimeout } from "node:timers/promises";
import type { Environment } from "vitest/runtime";

const { default: domEnvironment }: typeof import("@shivaedev/test-story/server/domEnvironment.config.ts") = createRequire(import.meta.url)(
	"@shivaedev/test-story/server/domEnvironment.config.ts",
);

const environment: Environment = {
	...domEnvironment,
	async setup(global, options) {
		const dom = await domEnvironment.setup(global, options);
		return {
			async teardown(target) {
				await dom.teardown(target);
				// Observe nanostores' delayed unmount after the DOM globals have gone.
				await setTimeout(1100);
			},
		};
	},
};

export default environment;
