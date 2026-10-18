import { expect } from "vitest";
import { codePreviewScreen, screens } from "#test-support/screens.ts";

screens.it(
	"renders context, removed and added code lines with their theme tokens and markers",
	[
		codePreviewScreen([
			{ kind: "context", number: 1, text: "const note = {" },
			{ kind: "removed", number: 2, text: '  title: "Draft"' },
			{ kind: "added", number: 3, text: '  title: "Saved"' },
		]),
	],
	function* ({ codePreview }) {
		const preview = yield* codePreview();
		expect(preview.parentElement?.getAttribute("aria-label")).toBe("Note changes");
		expect(preview.classList).toContain("font-mono");
		const lines = [...preview.querySelectorAll("code > span")];
		expect(lines.map((line) => line.getAttribute("data-line-kind"))).toEqual(["context", "removed", "added"]);
		expect(lines.map((line) => line.textContent)).toEqual(["  const note = {\n", '-   title: "Draft"\n', '+   title: "Saved"\n']);
		expect(lines[0]?.classList).toContain("text-muted-foreground");
		expect(lines[1]?.classList).toContain("text-destructive");
		expect(lines[2]?.classList).toContain("text-code-added");
	},
);
