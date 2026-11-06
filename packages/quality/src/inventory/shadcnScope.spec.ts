import { inventoryStory, repositoryHas } from "#test/inventoryStory.ts";
import { shadcnApplication } from "#test/shadcnApplication.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

inventoryStory.it(
	"a nested package skips only declared stock files, keeping helpers, tests and matching names elsewhere",
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

		yield* assertThat(yield* sourcePaths(), (actual) =>
			actual.toEqual([
				"apps/web/src/components/button.tsx",
				"apps/web/src/components/ui/button.test.tsx",
				"apps/web/src/components/ui/buttonHelpers.ts",
				"apps/web/src/components/ui/handWritten.tsx",
				"apps/web/src/main.ts",
			]),
		);
	},
);
