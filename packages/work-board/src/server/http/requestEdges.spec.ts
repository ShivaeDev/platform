import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { growingScreenshot, imageNamedDirectory } from "#test/servingStoryTraits.ts";

const note = projectFiles({ "note.md": "# Reading context" });

for (const host of ["board.example", "board.example:4747", "["]) {
	boardStory.it(`a request addressed to ${host} is refused as not loopback`, [note], function* ({ download }) {
		expect(yield* download("/", { host })).toMatchObject({ status: "Forbidden", text: "Only loopback hosts are served" });
	});
}

boardStory.it("a request addressed to localhost on the board's port is served", [note], function* ({ board, statusOf }) {
	expect(yield* statusOf("/", `localhost:${board.port}`)).toBe("OK");
});

boardStory.it("an RPC request addressed to a host that is not loopback is refused", [note], function* ({ download }) {
	expect(yield* download("/_board/rpc", { host: "evil.example" }, "POST")).toMatchObject({ status: "Forbidden" });
});

boardStory.it("an RPC request with a malformed Origin is refused as not same-origin", [note], function* ({ board, download }) {
	expect(
		yield* download("/_board/rpc", { "content-type": "application/json", host: `127.0.0.1:${board.port}`, origin: ":invalid:" }, "POST"),
	).toMatchObject({
		status: "Forbidden",
		text: "Local same-origin requests only",
	});
});

boardStory.it("an RPC request carrying 1 MiB is answered", [note], function* ({ paddedRpc }) {
	expect(yield* paddedRpc(1024 * 1024)).toBe("answered");
});

boardStory.it("an RPC request carrying more than 8 MiB is refused", [note], function* ({ paddedRpc }) {
	expect(yield* paddedRpc(8 * 1024 * 1024 + 4096)).toBe("refused: Bad Request");
});

boardStory.it("an image-named directory answers Not Found as an unavailable image", [note, imageNamedDirectory], function* ({ download }) {
	expect(yield* download("/_board/attachment/screenshot.png")).toMatchObject({
		status: "Not Found",
		text: "Local image unavailable: unsupported type, missing file or workspace boundary.",
	});
});

boardStory.it(
	"a screenshot that grows past 16 MiB between its size check and its read answers Payload Too Large",
	[note, growingScreenshot],
	function* ({ download }) {
		expect(yield* download("/_board/attachment/screenshot.png")).toMatchObject({
			status: "Payload Too Large",
			text: "Local image exceeds the 16 MiB limit.",
		});
	},
);
