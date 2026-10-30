import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"RPC clients read indexed metadata and diagnostics and receive live index changes",
	[projectFiles({ "brief.md": "---\nid: brief\nkind: task\n---\n# Before" })],
	function* ({ rpc, watchIndex, editFile }) {
		const before = yield* rpc((client) => client("work-board.index", undefined));
		expect(before.documents[0]?.parsed.fields).toMatchObject({ id: "brief", kind: "task" });
		expect(before.files.map((file) => file.path)).toEqual(["brief.md"]);
		const events = yield* watchIndex();
		expect(yield* events.next()).toEqual({ _tag: "Resync" });

		editFile("brief.md", "---\nid: brief\nkind: invalid\n---\n# After");

		expect(yield* events.next()).toMatchObject({
			_tag: "Changed",
			keys: expect.arrayContaining([{ _tag: "Bucket", collection: "work-board/index", field: "workspace", value: "local" }]),
		});
		const after = yield* rpc((client) => client("work-board.index", undefined));
		expect(after.documents[0]?.parsed.body).toBe("# After");
		expect(after.diagnostics).toEqual([{ diagnostics: expect.arrayContaining([expect.objectContaining({ field: "kind" })]), file: "brief.md" }]);
		expect(after.revision).toBeGreaterThan(before.revision);
	},
);
