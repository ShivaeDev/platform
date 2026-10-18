import { expect } from "vitest";
import { codePreviewScreen, screens } from "#test-support/screens.ts";

screens.it(
	"renders context, removed and added code lines with their markers and text",
	[
		codePreviewScreen([
			{ kind: "context", number: 1, text: "const note = {" },
			{ kind: "removed", number: 2, text: '  title: "Draft"' },
			{ kind: "added", number: 3, text: '  title: "Saved"' },
		]),
	],
	function* ({ closeScreen, consoleErrors, codePreview }) {
		const preview = yield* codePreview();
		const lines = [...preview.querySelectorAll("code > span")];
		expect(lines.map((line) => line.getAttribute("data-line-kind"))).toEqual(["context", "removed", "added"]);
		expect(lines.map((line) => line.textContent)).toEqual(["  const note = {\n", '-   title: "Draft"\n', '+   title: "Saved"\n']);
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);
