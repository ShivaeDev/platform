import { describe, expect, it } from "vitest";
import { metadataParse } from "./parse.ts";

describe("optional metadata", () => {
	it("keeps ordinary Markdown byte-for-byte and recognizes only an opening header", () => {
		for (const source of ["# Plain\n\n---\nFooter", "\n---\nid: late\n---\n# Plain", "# Board\n\n## Review\n\n### Item"]) {
			expect(metadataParse(source).body).toBe(source);
		}
	});
	it("decodes declared fields and records exact CRLF/BOM source lines", () => {
		const source =
			"\uFEFF---\r\nid: work.search\r\nkind: task\r\nstatus: in-review\r\nowner: agent\r\nnext_action: Inspect evidence\r\ncriteria:\r\n  - id: keyboard\r\n    text: Escape returns focus\r\n---\r\n# Search\r\n";
		const parsed = metadataParse(source);
		expect(parsed.fields).toEqual({
			criteria: [{ id: "keyboard", text: "Escape returns focus" }],
			id: "work.search",
			kind: "task",
			nextAction: "Inspect evidence",
			owner: "agent",
			status: "in-review",
		});
		expect(parsed.body).toBe("# Search\r\n");
		expect(parsed.bodyLine).toBe(11);
		expect(parsed.lines.id).toBe(2);
		expect(parsed.lines.criteria).toBe(7);
		expect(parsed.lines["criteria.0"]).toBe(8);
		expect(parsed.lines["criteria.0.text"]).toBe(9);
		expect(parsed.raw + parsed.body).toBe(source);
		expect(parsed.diagnostics).toEqual([]);
	});
	it("preserves unknown/invalid data and interprets the independent valid fields", () => {
		const parsed = metadataParse("---\nid: work.search\nstatus: 7\ncriteria: keyboard\nrisk_budget: strict\n---\n# Readable\n");
		expect(parsed.fields).toEqual({ id: "work.search" });
		expect(parsed.diagnostics.map((problem) => problem.field)).toEqual(["status", "criteria", "risk_budget"]);
		expect(parsed.raw).toContain("risk_budget: strict");
		expect(parsed.body).toBe("# Readable\n");
	});
	it.each(["id: [", "id: one\nid: two", "id: !unsupported work.search"])("does not invent metadata from malformed YAML (%s)", (yaml) => {
		const parsed = metadataParse(`---\n${yaml}\n---\n# Readable`);
		expect(parsed.fields).toEqual({});
		expect(parsed.diagnostics.length).toBeGreaterThan(0);
		expect(parsed.body).toBe("# Readable");
		expect(parsed.raw).toContain(yaml);
	});
	it("keeps ambiguous horizontal-rule prose and unterminated headers readable", () => {
		for (const source of ["---\nPlain prose\n---\nMore prose", "---\nid: work.search\n# Still readable"]) {
			const parsed = metadataParse(source);
			expect(parsed.body).toBe(source);
			expect(parsed.diagnostics.length).toBeGreaterThan(0);
		}
	});
	it("requires explicit evidence source, full revision, timezone, and known nested fields", () => {
		const good = metadataParse(
			`---\nevidence:\n  - source: evidence.md\n    criterion: work.search#keyboard\n    checked_revision: "${"a".repeat(40)}"\n    observed_at: "2026-10-05T00:00:00Z"\n    method: browser\n    outcome: passed\n---\n# Evidence`,
		);
		expect(good.fields.evidence).toHaveLength(1);
		expect(good.diagnostics).toEqual([]);
		for (const yaml of [
			"  - outcome: passed",
			"  - source: evidence.md\n    checked_revision: abc",
			"  - source: evidence.md\n    observed_at: yesterday",
			"  - source: evidence.md\n    extra: unknown",
		]) {
			expect(metadataParse(`---\nevidence:\n${yaml}\n---\nProse`).fields.evidence).toBeUndefined();
		}
	});
	it("rejects alias expansion beyond the parser bound while keeping source and prose", () => {
		const yaml = "a: &a [x, x, x, x, x, x, x, x, x, x]\nb: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]\nc: [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]";
		const parsed = metadataParse(`---\n${yaml}\n---\n# Safe`);
		expect(parsed.fields).toEqual({});
		expect(parsed.body).toBe("# Safe");
		expect(parsed.diagnostics.some((problem) => problem.message.includes("aliases"))).toBe(true);
	});
	it("uses literal ASCII IDs and the declared source spelling for mapped fields", () => {
		const valid = metadataParse("---\nid: Work.A-1\nnext_action: Review\nnextAction: Uninterpreted\n---\n# Item");
		expect(valid.fields.id).toBe("Work.A-1");
		expect(valid.fields.nextAction).toBe("Review");
		expect(valid.diagnostics[0]?.message).toContain("Unknown field nextAction");
		expect(metadataParse("---\nid: Kelvin\n---\n# Item").fields.id).toBeUndefined();
	});
});
