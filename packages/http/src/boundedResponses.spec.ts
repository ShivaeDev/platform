import { expect } from "vitest";
import { httpClient, remoteDeclaresOversizedBody, remoteSends, remoteSendsJson, remoteStreamsSixteenBytes } from "#test/http-client/story.ts";

httpClient.it(
	"a body declaring Content-Length: 1000 fails as over a 10-byte limit while the remote still holds the rest",
	[remoteDeclaresOversizedBody],
	function* ({ readBytes }) {
		expect(yield* readBytes(10)).toBe("body over 10 bytes");
	},
);

httpClient.it(
	"a chunked body that passes 10 bytes fails as over a 10-byte limit while the remote holds the response open",
	[remoteStreamsSixteenBytes],
	function* ({ readBytes }) {
		expect(yield* readBytes(10)).toBe("body over 10 bytes");
	},
);

httpClient.it("an 11-byte body in two chunks reads in full under an 11-byte limit", [remoteSends("paper", " & ink")], function* ({ readBytes }) {
	expect(yield* readBytes(11)).toEqual(new TextEncoder().encode("paper & ink"));
});

httpClient.it(
	"text whose é is split across two chunks reads as é",
	[remoteSends(new Uint8Array([0xc3]), new Uint8Array([0xa9]))],
	function* ({ readText }) {
		expect(yield* readText(2)).toBe("é");
	},
);

httpClient.it("a JSON body naming paper decodes through the caller's Schema", [remoteSendsJson({ name: "paper" })], function* ({ readJson }) {
	expect(yield* readJson(100)).toEqual({ name: "paper" });
});

httpClient.it("a JSON body whose name is the number 12 fails as a Schema mismatch", [remoteSendsJson({ name: 12 })], function* ({ readJson }) {
	expect(yield* readJson(100)).toBe("Schema mismatch");
});

httpClient.it(
	"a 16-byte JSON body that matches the Schema still fails as over a 10-byte limit",
	[remoteSendsJson({ name: "paper" })],
	function* ({ readJson }) {
		expect(yield* readJson(10)).toBe("body over 10 bytes");
	},
);
