import { expect } from "vitest";
import { inventoryStory, repositoryHas } from "#test/inventoryStory.ts";
import { shadcnApplication } from "#test/shadcnApplication.ts";

inventoryStory.it(
	"a nested app skips stock shadcn filenames only inside its configured UI folder, keeping helpers, tests and stock names elsewhere",
	[
		repositoryHas(
			...shadcnApplication().map((file) => ({ ...file, path: `apps/web/${file.path}` })),
			{ content: "debugger;", path: "apps/web/src/components/button.tsx" },
			{ content: "debugger;", path: "apps/web/src/components/ui/button.test.tsx" },
			{ content: "debugger;", path: "apps/web/src/components/ui/buttonHelpers.ts" },
		),
	],
	function* ({ collects, sourcePaths }) {
		yield* collects({ sources: ["apps/web/src"] });

		expect(yield* sourcePaths()).toEqual([
			"apps/web/src/components/button.tsx",
			"apps/web/src/components/ui/button.test.tsx",
			"apps/web/src/components/ui/buttonHelpers.ts",
			"apps/web/src/components/ui/handWritten.tsx",
			"apps/web/src/main.ts",
		]);
	},
);
