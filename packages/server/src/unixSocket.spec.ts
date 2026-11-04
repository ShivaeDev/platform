import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { alongsideTcp, regularFile, stale, unixHost } from "#test/unix-host/story.ts";

for (const [mode, traits] of [
	["Unix only", []],
	["TCP and Unix", [alongsideTcp]],
] as const) {
	unixHost.it(`a ${mode} application host answers RPC over its Unix socket`, traits, function* ({ address, read }) {
		yield* outcomes([
			["listener address", () => address(), mode],
			["RPC answer", () => read(), "Original"],
		]);
	});
}
unixHost.it("the live query delivers the saved result over a Unix socket", [], function* ({ follow, nextResult, save }) {
	yield* follow();
	expect(yield* nextResult()).toBe("Original");

	yield* save("Saved through Unix RPC");

	expect(yield* nextResult()).toBe("Saved through Unix RPC");
});
unixHost.it("the published Unix socket has mode 0600", [], function* ({ socketFile }) {
	expect(yield* socketFile()).toEqual({ mode: 0o600, type: "Socket" });
});
unixHost.it("startup replaces a crashed process's stale socket and answers RPC", [stale], function* ({ read }) {
	expect(yield* read()).toBe("Original");
});
unixHost.it("shutdown removes the Unix socket file", [], function* ({ close, socketFile }) {
	expect(yield* socketFile()).toEqual({ mode: 0o600, type: "Socket" });

	yield* close();

	expect(yield* socketFile()).toBe("missing");
});

unixHost.it("a regular file at the socket path refuses startup and keeps its contents", [regularFile], function* ({ startup, fileContents }) {
	yield* outcomes([
		["startup", () => startup(), "The Unix socket path is not a socket: app.sock"],
		["existing file", () => fileContents(), "Keep this file"],
	]);
});
