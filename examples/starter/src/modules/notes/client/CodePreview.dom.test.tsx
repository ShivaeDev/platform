import { expect } from "vitest";
import { codePreviewScreen, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"the code preview marks context, removed and added lines with a space, minus and plus",
	[
		codePreviewScreen([
			{ kind: "context", number: 1, text: "const note = {" },
			{ kind: "removed", number: 2, text: '  title: "Draft"' },
			{ kind: "added", number: 3, text: '  title: "Saved"' },
		]),
	],
	function* ({ codeLines }) {
		expect(yield* codeLines()).toEqual(["context:   const note = {\n", 'removed: -   title: "Draft"\n', 'added: +   title: "Saved"\n']);
	},
);
