import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { metadataModel } from "#metadata/model.ts";
import { metadataParse } from "#metadata/parse.ts";
import { entriesOf } from "#search/entries.ts";
import { searchMatch } from "#search/match.ts";
import { metadataEntries } from "#search/metadataEntries.ts";
import { DUPLICATE_CRITERION_SOURCE } from "#test/coverageEdges.ts";

it("omits duplicated criterion identities from search rather than linking to an arbitrary claim", () => {
	const documents = [{ file: "item.md", parsed: metadataParse(DUPLICATE_CRITERION_SOURCE) }];
	expect(metadataEntries([], documents, metadataModel(documents))).toEqual([]);
});

it.live("discloses both omitted ends of a long matching passage without changing its source destination", function* () {
	const text = `${"Before ".repeat(30)}needle${" after".repeat(40)}`;
	const entries = yield* Effect.promise(() => entriesOf(`# Context\n\n${text}\n`, "note.md", false));
	const result = searchMatch(entries, "needle").results[0];
	expect(result?.snippet).toBe(`…${text.slice(text.indexOf("needle") - 50, text.indexOf("needle") + 130)}…`);
	expect(result?.href).toBe("/note.md#heading-context");
});
