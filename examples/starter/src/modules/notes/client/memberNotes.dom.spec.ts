import { expect } from "vitest";
import { notesApp, signedInMembers } from "#modules/notes/test-support/app.tsx";

notesApp.it("bob does not see alice's notes and each member keeps their own draft", [signedInMembers("alice", "bob")], function* ({ as }) {
	yield* as("alice").find({ name: "New note", role: "textbox" });
	yield* as("bob").find({ name: "New note", role: "textbox" });
	expect(as("alice").text()).toContain("No notes yet");
	expect(as("bob").text()).toContain("No notes yet");
	yield* as("bob").enter({ name: "New note", role: "textbox" }, "Bob's draft");

	yield* as("alice").enter({ name: "New note", role: "textbox" }, "Alice's private note");
	yield* as("alice").click({ name: "Add note", role: "button" });
	yield* as("alice").find({ name: "Alice's private note", role: "link" });
	yield* as("bob").click({ name: "Refresh", role: "button" });
	yield* as("bob").settle();

	expect(as("alice").within({ name: "Saved notes", role: "region" }).text()).toContain("Alice's private note");
	expect(as("bob").within({ name: "Saved notes", role: "region" }).text()).toContain("No notes yet");
	expect(as("bob").text()).not.toContain("Alice's private note");
	expect(as("bob").value({ name: "New note", role: "textbox" })).toBe("Bob's draft");
});
