import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { entriesOf } from "./entries.ts";

it.live("collects real Markdown/reference links through the existing parse, excluding code and generated anchors", function* () {
	const links = new Set<string>();
	yield* Effect.promise(() =>
		entriesOf(
			"# Heading\n\n[Real link][record]\n\n[record]: ../evidence.md#heading-observation\n\n`[Fake](../fake.md)`\n\n```md\n[Also fake](../fake.md)\n```\n\n[Passage](#heading-one)\n",
			"nested/note.md",
			false,
			1,
			links,
		),
	);
	expect([...links]).toEqual(["../evidence.md#heading-observation"]);
});

it.live("deduplicates a home board's repeated source links while preserving reference definitions", function* () {
	const links = new Set<string>();
	yield* Effect.promise(() =>
		entriesOf(
			"# Home\n\n## To read\n\n### One\n\n[Record][record]\n\n### Two\n\n[Record][record]\n\n[record]: notes/evidence.md\n",
			"home.md",
			true,
			1,
			links,
		),
	);
	expect([...links]).toEqual(["notes/evidence.md"]);
});
