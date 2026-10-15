import { expect, it } from "vitest";
import { inboxSnapshot } from "#test/inboxFixture.ts";
import { libraryData } from "./libraryData.ts";

it("uses indexed titles and listed modification times, and omits receipt records until requested", () => {
	const snapshot = inboxSnapshot({
		"nested/slug.md": "---\nkind: task\nstatus: active\n---\n# A readable title\n",
		"receipt.md": `---\nkind: result\nrequest_receipt:\n question: request\n disposition: superseded\n recordedAt: 0\n reviewedRevision: ${"a".repeat(64)}\n---\n# Receipt\n`,
	});
	const files = snapshot.documents.map((entry) => ({ modified: 123_456, path: entry.file }));
	const result = libraryData(files, snapshot, {});
	expect(result.files).toEqual([
		{ href: "/nested/slug.md", kind: "task", modified: 123_456, path: "nested/slug.md", status: "active", title: "A readable title" },
	]);
	expect(result.fleetCount).toBe(1);
	expect(libraryData(files, snapshot, { showFleet: true }).files).toHaveLength(2);
	expect(libraryData(files, snapshot, { folder: "" }).files).toEqual([]);
	expect(libraryData(files, snapshot, { folder: "" }).folders).toEqual([{ count: 1, name: "nested", path: "nested" }]);
	expect(libraryData(files, snapshot, { folder: "nested", kind: "task", status: "active" }).files).toEqual(result.files);
});
