import { expect, it } from "vitest";
import { metadataParse } from "./parse.ts";

const REQUEST =
	"  - id: Review.A-1\n    kind: review\n    state: open\n    response_from: [marvin]\n    reason: Review keyboard evidence\n    unblocks: [work.search#keyboard]";

it("decodes independent explicit requests and preserves their exact source locations", () => {
	const source = `---\nid: result.search\nattention:\n${REQUEST}\n${REQUEST.replace("Review.A-1", "other").replace("state: open", "state: closed")}\n---\n# Prose`;
	const parsed = metadataParse(source);
	expect(parsed.fields.attention?.map((item) => [item.id, item.state, item.responseFrom])).toEqual([
		["Review.A-1", "open", ["marvin"]],
		["other", "closed", ["marvin"]],
	]);
	expect(parsed.lines["attention.0.response_from"]).toBe(7);
	expect(parsed.lines["attention.1.id"]).toBe(10);
	expect(parsed.raw + parsed.body).toBe(source);
	expect(parsed.diagnostics).toEqual([]);
});

it("does not guess requests from statuses, owners or actions", () => {
	expect(metadataParse("---\nstatus: blocked\nowner: marvin\nnext_action: Please review\n---\n# Item").fields.attention).toBeUndefined();
	expect(metadataParse("---\nattention: []\n---\n# Item").fields.attention).toEqual([]);
});

it("retains invalid request lists without interpreting a partial or camel-case contract", () => {
	for (const broken of [
		REQUEST.replace("kind: review", "kind: urgent"),
		REQUEST.replace("state: open", "state: waiting"),
		REQUEST.replace("    state: open\n", ""),
		REQUEST.replace("response_from: [marvin]", "response_from: []"),
		REQUEST.replace("response_from: [marvin]", "responseFrom: [marvin]"),
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
