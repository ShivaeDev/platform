import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { notesScreen } from "#test/notesScreen.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

notesScreen.it("a command refetches the rendered notes through native RPC", [], function* ({ click, settle, text }) {
	yield* settle();
	expect(text("output")).toBe("");

	yield* click({ name: "Add", role: "button" });
	yield* settle();

	expect(text("output")).toBe("Morning walk");
});
