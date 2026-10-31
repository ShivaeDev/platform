import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

const project = projectFiles({ "note.md": "# Notes" });
const ndjson = { "content-type": "application/ndjson" };

boardStory.it("a native RPC post over TCP with the ndjson content type is answered", [project], function* ({ rpcPostStatus }) {
	expect(yield* rpcPostStatus(ndjson)).toBe("200");
});

for (const [kind, headers] of [
	["from an untrusted Host", { ...ndjson, host: "untrusted.example" }],
	["from an untrusted Origin", { ...ndjson, origin: "http://untrusted.example" }],
	["with a JSON content type, even from the board's own origin", { "content-type": "application/json", origin: "the board" }],
] as const) {
	boardStory.it(`a native RPC post over TCP ${kind} is forbidden`, [project], function* ({ rpcPostStatus }) {
		expect(yield* rpcPostStatus(headers)).toBe("403");
	});
}
