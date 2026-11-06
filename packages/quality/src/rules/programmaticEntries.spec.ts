import { unusedCode } from "#rules/unusedCode.ts";
import { programmaticEntries } from "#test/programmaticEntries.ts";
import { ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

ruleStory.it(
	"code/unused follows bundled main and preload entries but still reports abandoned files and exports",
	[programmaticEntries()],
	function* ({ check }) {
		const findings = yield* check(unusedCode);

		yield* assertThat(
			findings
				.filter(({ subject }) => subject?.startsWith("files:") || subject?.startsWith("exports:"))
				.map(({ file, subject }) => ({ file, subject })),
			(actual) =>
				actual.toEqual([
					{ file: "apps/desktop/script/abandoned.ts", subject: "files:apps/desktop/script/abandoned.ts" },
					{ file: "apps/desktop/script/notes.ts", subject: "files:apps/desktop/script/notes.ts" },
					{ file: "apps/desktop/src/abandoned.ts", subject: "files:apps/desktop/src/abandoned.ts" },
					{ file: "apps/desktop/src/mentioned.ts", subject: "files:apps/desktop/src/mentioned.ts" },
					{ file: "apps/desktop/src/unshipped.ts", subject: "files:apps/desktop/src/unshipped.ts" },
					{ file: "apps/desktop/src/launch.ts", subject: "exports:abandonedExport" },
				]),
		);
	},
);
