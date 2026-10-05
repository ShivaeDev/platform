import { expect, it } from "vitest";
import { metadataModel } from "#metadata/model.ts";
import { metadataParse } from "#metadata/parse.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { overviewHtml } from "./overviewHtml.ts";

it("orders requests by title then exact IDs and escapes literal source values", () => {
	const documents = ["z", "a"].map((id) => ({
		file: `${id}.md`,
		parsed: metadataParse(
			`---\nid: ${id}\nattention:\n  - id: z\n    kind: review\n    state: open\n    reason: '<img src=x onerror=alert(1)>'\n    response_from: ['<script>bad</script>']\n    unblocks: [${id}]\n  - id: a\n    kind: review\n    state: open\n    reason: First question\n    response_from: [reader]\n    unblocks: [${id}]\n---\n# Same title`,
		),
	}));
	const snapshot: Snapshot = {
		documents,
		entries: documents.map((source) => ({ file: source.file, href: `/${source.file}`, kind: "document", text: "", title: "Same title" })),
		model: metadataModel(documents),
		revision: 1,
		unavailable: [],
	};
	const html = overviewHtml(snapshot);
	expect(
		[...html.matchAll(/data-attention-item="(?<item>[^"]+)" data-request="(?<request>[^"]+)"/gu)].map((match) => [
			match.groups?.item,
			match.groups?.request,
		]),
	).toEqual([
		["a", "a"],
		["a", "z"],
		["z", "a"],
		["z", "z"],
	]);
	expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
	expect(html).toContain("&lt;script&gt;bad&lt;/script&gt;");
	expect(html).not.toContain("<script>bad</script>");
});
