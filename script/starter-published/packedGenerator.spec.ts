import { expect } from "vitest";
import { generator } from "#starter-published/test-support/generator.ts";

generator.it(
	"the packed create-app installs its workspace dependencies from the archives, not the registry",
	[],
	function* ({ generate, starterOrigin }) {
		yield* generate();
		expect(yield* starterOrigin()).toBe("packed archive");
	},
);
