import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { fixtureSnapshot } from "#test/fixtureSnapshot.ts";
import { paletteFixture } from "#test/paletteFixture.ts";
import { searchMatch } from "./match.ts";

it.live("ranks the inbox task ahead of ten Fleet decisions and excludes records until requested", function* () {
	const snapshot = yield* fixtureSnapshot(paletteFixture(), undefined);
	const ordinary = searchMatch(snapshot.entries, "inbox");
	expect(ordinary.results[0]).toMatchObject({ id: "task.triage", itemKind: "task", status: "active", title: "Build the inbox" });
	expect(ordinary.results.some((entry) => entry.record)).toBe(false);
	const all = searchMatch(snapshot.entries, "records: inbox");
	expect(all.results[0]?.id).toBe("task.triage");
	expect(new Set(all.results.filter((entry) => entry.record && entry.itemKind === "decision").map((entry) => entry.id)).size).toBe(10);
	expect(searchMatch(snapshot.entries, "task.triage").results[0]?.id).toBe("task.triage");
	for (const query of ["records: inbox", "records: task.example", "records: application", "records: recorded", "records: context"]) {
		for (const entry of searchMatch(snapshot.entries, query).results) {
			expect(entry.snippet).not.toMatch(/^(?:\{|---)/u);
			expect(entry.snippet).not.toMatch(/(?:id|kind|next_action|reviewedRevision|question):/u);
		}
	}
});

it.live("hides captured questions, responses and application receipts but keeps ordinary human questions", function* () {
	const snapshot = yield* fixtureSnapshot(
		{ ...paletteFixture(), "human.md": "---\nid: question.human\nkind: question\n---\n# Human question\n" },
		undefined,
	);
	for (const query of ["question", "answer", "application", "context"]) {
		expect(searchMatch(snapshot.entries, query).results.some((entry) => entry.record)).toBe(false);
		expect(searchMatch(snapshot.entries, `records: ${query}`).results.some((entry) => entry.record)).toBe(true);
	}
	expect(searchMatch(snapshot.entries, "human").results[0]?.id).toBe("question.human");
});

it.live("never uses malformed YAML, raw JSON or embedded key lists as snippets", function* () {
	const files = {
		"boolean.md": '# Context\n\nNeedle captured {"active":true,"ready":false}.\n',
		"embedded.md": '# Context\n\nCaptured data {"id": "needle", "kind": "task"} ends here.\n',
		"json.md": '# Context\n\n{"id": "needle", "kind": "task"}\n',
		"spaced.md": '# Context\n\nCaptured data {"id" : "needle", "kind" : "task"} ends here.\n',
		"yaml.md": "---\nid: needle\nkind: task\nstatus: active\n",
	};
	const snapshot = yield* fixtureSnapshot(files, undefined);
	const results = searchMatch(snapshot.entries, "needle").results;
	expect(results.length).toBeGreaterThan(0);
	expect(results.find((entry) => entry.file === "spaced.md")?.snippet).toBe("");
	expect(results.every((entry) => entry.snippet === "")).toBe(true);
	const readable = yield* fixtureSnapshot({ "note.md": "# Note\n\nA readable needle passage.\n" }, undefined);
	expect(searchMatch(readable.entries, "needle").results[0]?.snippet).toBe("A readable needle passage.");
});
