import { expect, it } from "vitest";
import { metadataModel } from "#server/metadata/model.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { metadataHtml } from "#server/page/metadata.ts";
import { recordSourceFixture } from "#test/recordSourceFixture.ts";

it.each(recordSourceFixture)("keeps $file record explanations inside the fallback Source disclosure", ({ file, source, explanation }) => {
	const parsed = metadataParse(source);
	expect(parsed.diagnostics).toEqual([]);
	const model = metadataModel([{ file, parsed }]);
	const content = document.createElement("main");
	content.innerHTML = metadataHtml(parsed, file, model);
	const records = content.querySelector<HTMLDetailsElement>('details[data-key="frontmatter-source"]');
	expect(records?.open).toBe(false);
	expect(records?.textContent).toContain(explanation);
	expect(records?.textContent).toContain("Reviewed SHA-256:");
	records?.remove();
	expect(content.textContent).not.toContain(explanation);
});
