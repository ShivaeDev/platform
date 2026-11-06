import { registryFacts } from "#test/consumerHeuristics.ts";
import { inventoryStory, repositoryHas } from "#test/inventoryStory.ts";
import { shadcnApplication } from "#test/shadcnApplication.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

inventoryStory.it(
	"inventory includes 17 customized registry filenames and excludes only files declared tool-owned",
	[
		repositoryHas(
			...shadcnApplication(),
			...[
				"accordion",
				"avatar",
				"badge",
				"breadcrumb",
				"card",
				"checkbox",
				"dialog",
				"dropdown-menu",
				"field",
				"input",
				"label",
				"popover",
				"select",
				"separator",
				"sheet",
				"tabs",
				"tooltip",
			].map((name) => ({ content: "debugger;", path: `src/components/ui/${name}.tsx` })),
		),
	],
	function* ({ collects, sourcePaths }) {
		yield* collects({ sources: ["src"] });

		yield* assertThat(yield* sourcePaths(), (actual) =>
			actual.toEqual([
				"src/components/ui/accordion.tsx",
				"src/components/ui/avatar.tsx",
				"src/components/ui/badge.tsx",
				"src/components/ui/breadcrumb.tsx",
				"src/components/ui/card.tsx",
				"src/components/ui/checkbox.tsx",
				"src/components/ui/dialog.tsx",
				"src/components/ui/dropdown-menu.tsx",
				"src/components/ui/field.tsx",
				"src/components/ui/handWritten.tsx",
				"src/components/ui/input.tsx",
				"src/components/ui/label.tsx",
				"src/components/ui/popover.tsx",
				"src/components/ui/select.tsx",
				"src/components/ui/separator.tsx",
				"src/components/ui/sheet.tsx",
				"src/components/ui/tabs.tsx",
				"src/components/ui/tooltip.tsx",
				"src/main.ts",
			]),
		);
	},
);

for (const [name, glob, reason, message] of [
	["a blank ownership reason", "src/components/ui/button.tsx", "", "a reason for this glob"],
	["a stale ownership declaration", "src/components/ui/missing.tsx", "The registry owns this file.", "matches no current file"],
] as const) {
	inventoryStory.it(
		`inventory refuses ${name} with its declaration problem`,
		[repositoryHas(...registryFacts(glob, reason))],
		function* ({ collects, failure }) {
			yield* collects();

			yield* assertThat(yield* failure(), (actual, expect) => actual.toEqual(expect.stringContaining(message)));
		},
	);
}
