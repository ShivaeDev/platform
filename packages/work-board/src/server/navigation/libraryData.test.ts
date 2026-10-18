import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"lists readable indexed titles and real modification times and reveals receipts only on request",
	[
		projectFiles({
			"nested/slug.md": "---\nkind: task\nstatus: active\n---\n# A readable title\n",
			"receipt.md": `---\nkind: result\nrequest_receipt:\n question: request\n disposition: superseded\n recordedAt: 0\n reviewedRevision: ${"a".repeat(64)}\n---\n# Receipt\n`,
		}),
	],
	function* ({ rpc }) {
		const result = yield* rpc((client) => client("work-board.library", {}));
		expect(result.files).toEqual([expect.objectContaining({ href: "/nested/slug.md", kind: "task", status: "active", title: "A readable title" })]);
		expect(result.files[0]?.modified).toBeGreaterThan(0);
		expect(result.fleetCount).toBe(1);
		expect((yield* rpc((client) => client("work-board.library", { showFleet: true }))).files).toHaveLength(2);
		const root = yield* rpc((client) => client("work-board.library", { folder: "" }));
		expect(root.files).toEqual([]);
		expect(root.folders).toEqual([{ count: 1, name: "nested", path: "nested" }]);
		expect((yield* rpc((client) => client("work-board.library", { folder: "nested", kind: "task", status: "active" }))).files).toEqual(result.files);
	},
);
