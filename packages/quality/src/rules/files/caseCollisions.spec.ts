import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { distinctCase } from "#rules/files/distinctCase.ts";
import { checkoutLists, listedCheckout } from "#test/listedCheckout.ts";

listedCheckout.it(
	"files/distinct-case reports a component and a topic module whose built files differ only by case, each naming the other",
	[checkoutLists("src/react/ReadingHistory.tsx", "src/react/readingHistory.ts", "src/react/ReadingPanel.tsx")],
	function* ({ check }) {
		const findings = yield* check(distinctCase);

		yield* assertThat(findings, (actual) =>
			actual.toEqual([
				{
					file: "src/react/ReadingHistory.tsx",
					message:
						'"ReadingHistory.tsx" and "readingHistory.ts" differ only by case, in their names or in the files they build to, so they are one path on a case-insensitive filesystem such as macOS or Windows. Rename one of them.',
				},
				{
					file: "src/react/readingHistory.ts",
					message:
						'"readingHistory.ts" and "ReadingHistory.tsx" differ only by case, in their names or in the files they build to, so they are one path on a case-insensitive filesystem such as macOS or Windows. Rename one of them.',
				},
			]),
		);
	},
);

listedCheckout.it(
	"files/distinct-case reports two documents whose names differ only by case",
	[checkoutLists("docs/README.md", "docs/readme.md")],
	function* ({ check, locations }) {
		yield* check(distinctCase);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["docs/README.md", "docs/readme.md"]));
	},
);

listedCheckout.it(
	"files/distinct-case reports two folders whose names differ only by case once, without the files inside them",
	[checkoutLists("src/Dialog/parts.ts", "src/dialog/parts.ts", "src/dialog/Dialog/index.ts")],
	function* ({ check, locations }) {
		yield* check(distinctCase);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/Dialog", "src/dialog"]));
	},
);

const distinct = [
	["a module folder and a stylesheet beside it", ["src/Panel/Panel.tsx", "src/panel.css"]],
	["an .mts and a .ts module, which build to .mjs and .js", ["src/Worker.mts", "src/worker.ts"]],
	["the same name in two folders", ["src/Item.tsx", "lib/Item.tsx"]],
] as const;

for (const [pair, paths] of distinct) {
	listedCheckout.it(`files/distinct-case accepts ${pair}`, [checkoutLists(...paths)], function* ({ check }) {
		yield* assertThat(yield* check(distinctCase), (actual) => actual.toEqual([]));
	});
}
