import { expect } from "@effect/vitest";
import { bridge } from "#test/bridge.ts";

bridge.it("MCP calls reach only an open session and strip provider routing fields", [], function* ({ start, call, calls }) {
	yield* start("alice");
	yield* start("bob");
	const reply = yield* call("session-2", "bob-call");

	expect(reply).toMatchObject({ content: [{ text: "bob", type: "text" }], isError: false });

	const refused = yield* call("missing-session", "wrong-call");

	expect(refused).toMatchObject({ isError: true });
	expect(yield* calls()).toEqual([{ args: { question: "which session?" }, callId: "bob-call", session: "bob" }]);
});
bridge.it("constrained permissions deny all tools before allowing the session tools", [], function* ({ start, request }) {
	yield* start("alice");
	yield* request();
	expect(yield* request()).toMatchObject({
		body: {
			permission: [
				{ action: "deny", pattern: "*", permission: "*" },
				{ action: "allow", pattern: "*", permission: "platform_answer" },
			],
		},
		path: "/session",
	});
});
bridge.it("closing a session unregisters its MCP handlers", [], function* ({ start, close, call }) {
	yield* start("alice");
	expect(yield* call("session-1", "before-close")).toMatchObject({ content: [{ text: "alice" }], isError: false });
	yield* close("alice");
	expect(yield* call("session-1", "after-close")).toMatchObject({ content: [{ text: "platform serves no open session session-1" }], isError: true });
});
