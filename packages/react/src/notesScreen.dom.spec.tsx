import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { notesScreen } from "#test/notesScreen.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

notesScreen.it("a command's change reaches the rendered notes through the live subscription", [], function* ({ click, settle, text }) {
	yield* settle();
	expect(text("output")).toBe("");

	yield* click({ name: "Add", role: "button" });
	yield* settle();

	expect(text("output")).toBe("Morning walk");
});
