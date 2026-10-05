import { expect, it } from "vitest";
import { entriesOf } from "./entries.ts";

it("collects real Markdown/reference links through the existing parse, excluding code and generated anchors", async () => {
	const links = new Set<string>();
	await entriesOf(
		"# Heading\n\n[Real link][record]\n\n[record]: ../evidence.md#heading-observation\n\n`[Fake](../fake.md)`\n\n```md\n[Also fake](../fake.md)\n```\n\n[Passage](#heading-one)\n",
		"nested/note.md",
		false,
		1,
		links,
	);
	expect([...links]).toEqual(["../evidence.md#heading-observation"]);
});

it("deduplicates a home board's repeated source links while preserving reference definitions", async () => {
	const links = new Set<string>();
	await entriesOf(
		"# Home\n\n## To read\n\n### One\n\n[Record][record]\n\n### Two\n\n[Record][record]\n\n[record]: notes/evidence.md\n",
		"home.md",
		true,
		1,
		links,
	);
	expect([...links]).toEqual(["notes/evidence.md"]);
});
