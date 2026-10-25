import { describe, expect, it } from "vitest";
import { metadataParse } from "./parse.ts";

describe("optional metadata", () => {
	it("recognizes addon-owned fields without interpreting them or hiding unowned fields", () => {
		const source =
			"---\nid: item.fixture\nfleet: approved\nfleet-launch: { effort: low }\ndelivers: report\nfleet-priority: urgent\nflavor: sweet\n---\n# Work";
		const parsed = metadataParse(source);
		expect(parsed.fields).toEqual({ delivers: "report", fleet: "approved", id: "item.fixture" });
		expect(parsed.diagnostics).toEqual([{ field: "flavor", line: 7, message: "Unknown field flavor; kept in the original frontmatter." }]);
		expect(parsed.raw + parsed.body).toBe(source);
	});
	it.each(["goal", "report"])("reads the %s item kind without losing its source meaning", (kind) => {
		const source = `---\nid: item.fixture\nkind: ${kind}\n---\n# An item`;
		const parsed = metadataParse(source);
		expect(parsed.fields.kind).toBe(kind);
		expect(parsed.diagnostics).toEqual([]);
		expect(parsed.raw + parsed.body).toBe(source);
	});
	it("reads area names and discloses invalid area lists without changing the source", () => {
		const valid = metadataParse("---\nareas: [work-fleet/host, work-board/ui]\n---\n# Work");
		expect(valid.fields.areas).toEqual(["work-fleet/host", "work-board/ui"]);
		expect(valid.diagnostics).toEqual([]);
		for (const areas of ["host", "[host, 3]", '[" "]']) {
			const source = `---\nareas: ${areas}\n---\n# Work`;
			const parsed = metadataParse(source);
			expect(parsed.fields.areas).toBeUndefined();
			expect(parsed.diagnostics[0]?.field).toBe("areas");
			expect(parsed.raw + parsed.body).toBe(source);
		}
	});
	it("keeps ordinary Markdown byte-for-byte and recognizes only an opening header", () => {
		for (const source of ["# Plain\n\n---\nFooter", "\n---\nid: late\n---\n# Plain", "# Board\n\n## Review\n\n### Item"]) {
			expect(metadataParse(source).body).toBe(source);
		}
	});
	it("decodes declared fields and records exact CRLF/BOM source lines", () => {
		const source =
			"\uFEFF---\r\nid: work.search\r\nkind: task\r\nstatus: ready\r\nowner: claude\r\nnext_action: Inspect evidence\r\ncriteria:\r\n  - id: keyboard\r\n    text: Escape returns focus\r\n---\r\n# Search\r\n";
		const parsed = metadataParse(source);
		expect(parsed.fields).toEqual({
			criteria: [{ id: "keyboard", text: "Escape returns focus" }],
			id: "work.search",
			kind: "task",
			nextAction: "Inspect evidence",
			owner: "claude",
			status: "ready",
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
	it("preserves source bytes and refuses invalid vocabulary", () => {
		const parsed = metadataParse("---\nid: work.search\nstatus: 7\ncriteria: keyboard\nrisk_budget: strict\n---\n# Readable\n");
		expect(parsed.fields).toEqual({});
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

const REQUEST =
	"  - id: Review.A-1\n    kind: review\n    state: open\n    response_from: [maintainer]\n    reason: Review keyboard evidence\n    unblocks: [work.search#keyboard]";

it("decodes independent explicit requests and preserves their exact source locations", () => {
	const source = `---\nid: result.search\nattention:\n${REQUEST}\n${REQUEST.replace("Review.A-1", "other").replace("state: open", "state: closed")}\n---\n# Prose`;
	const parsed = metadataParse(source);
	expect(parsed.fields.attention?.map((item) => [item.id, item.state, item.responseFrom])).toEqual([
		["Review.A-1", "open", ["maintainer"]],
		["other", "closed", ["maintainer"]],
	]);
	const lines = source.split("\n");
	expect(lines[(parsed.lines["attention.0.response_from"] ?? 0) - 1]).toBe("    response_from: [maintainer]");
	expect(lines[(parsed.lines["attention.1.id"] ?? 0) - 1]).toBe("  - id: other");
	expect(parsed.raw + parsed.body).toBe(source);
	expect(parsed.diagnostics).toEqual([]);
});

it("does not guess requests from statuses, owners or actions", () => {
	expect(metadataParse("---\nstatus: ready\nowner: marvin\nnext_action: Please review\n---\n# Item").fields.attention).toBeUndefined();
	expect(metadataParse("---\nattention: []\n---\n# Item").fields.attention).toEqual([]);
});

it("retains invalid request lists without interpreting a partial or camel-case contract", () => {
	for (const broken of [
		REQUEST.replace("kind: review", "kind: urgent"),
		REQUEST.replace("state: open", "state: waiting"),
		REQUEST.replace("    state: open\n", ""),
		REQUEST.replace("response_from: [maintainer]", "response_from: []"),
		REQUEST.replace("response_from: [maintainer]", "responseFrom: [maintainer]"),
		REQUEST.replace("reason: Review keyboard evidence", 'reason: " "'),
		REQUEST.replace("unblocks: [work.search#keyboard]", "unblocks: []"),
		REQUEST.replace("unblocks: [work.search#keyboard]", "unblocks: [https://example.com]"),
		`${REQUEST}\n    extra: invented`,
	]) {
		const parsed = metadataParse(`---\nid: result.search\nattention:\n${REQUEST}\n${broken}\n---\n# Readable`);
		expect(parsed.fields.attention).toBeUndefined();
		expect(parsed.fields.id).toBe("result.search");
		expect(parsed.diagnostics[0]?.field).toBe("attention");
		expect(parsed.raw).toContain(broken);
		expect(parsed.body).toBe("# Readable");
	}
});
