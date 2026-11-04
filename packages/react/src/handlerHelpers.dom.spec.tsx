import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { browserServices, defaultFailure, handlers, synchronousThrow } from "#test/handler-helpers/story.tsx";

handlers.it("a state initializer reads its id and time from runtime services", [], function* ({ shown }) {
	yield* outcomes([
		["initial id", () => shown("id"), "30db7efd-387a-497c-940b-3a28b7249f7e"],
		["initial time", () => shown("time"), "123000"],
	]);
});

handlers.it("a click generates another id and reads the runtime clock at invocation", [], function* ({ click, passes, shown }) {
	expect(yield* shown("stamp")).toBe("");
	yield* passes(2000);

	yield* click("Stamp");

	expect(yield* shown("stamp")).toBe("a5020b20-c736-4396-a6e0-305b30e3f006:125000");
});

handlers.it("the default client Crypto supplies ids to state initializers", [browserServices], function* ({ shown }) {
	expect(yield* shown("id")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
});

handlers.it("a promise action stays pending across a render and shows its success", [], function* ({ click, rerender, resolve, settle, shown }) {
	expect(yield* shown("pending")).toBe("false");

	yield* click("Copy");
	yield* rerender("changed while pending");

	expect(yield* shown("pending")).toBe("true");

	yield* resolve();
	yield* settle();

	yield* outcomes([
		["pending", () => shown("pending"), "false"],
		["result", () => shown("result"), "first clipboard text"],
	]);
});

handlers.it("a promise action calls the latest rendered callback", [], function* ({ click, rerender, resolve, settle, shown }) {
	yield* rerender("new clipboard text");

	yield* click("Copy");
	yield* resolve();
	yield* settle();

	expect(yield* shown("result")).toBe("new clipboard text");
});

handlers.it("a rejected promise action renders its mapped typed failure", [], function* ({ click, reject, settle, shown }) {
	expect(yield* shown("failure")).toBe("none");

	yield* click("Copy");
	yield* reject("Permission denied");
	yield* settle();

	expect(yield* shown("failure")).toBe("ClipboardDenied:Permission denied");
});

handlers.it(
	"a rejected promise action preserves the cause in UnknownError by default",
	[defaultFailure],
	function* ({ click, reject, settle, shown }) {
		yield* click("Copy");
		yield* reject("Permission denied");
		yield* settle();

		expect(yield* shown("failure")).toBe("UnknownError:Permission denied");
	},
);

handlers.it("a synchronous promise-call throw becomes a typed action failure", [synchronousThrow], function* ({ click, settle, shown }) {
	yield* click("Copy");
	yield* settle();

	expect(yield* shown("failure")).toBe("ClipboardDenied:Error: Clipboard unavailable");
});

handlers.it("the client Crypto layer runs a digest through a native action", [browserServices], function* ({ click, settle, shown }) {
	yield* click("Digest");
	yield* settle();

	expect(yield* shown("digest")).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
});
