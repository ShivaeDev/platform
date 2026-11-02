import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { modulesHost, replacedSource } from "#test/modules/story.ts";

modulesHost.it("both modules serve migrated titles through their HTTP RPC handlers", [], function* ({ read }) {
	yield* outcomes([
		["notes", () => read("notes.read"), "A note"],
		["tasks", () => read("tasks.read"), "A task"],
	]);
});

modulesHost.it("both modules mount their admin registrations on the HTTP transport", [], function* ({ read }) {
	yield* outcomes([
		["admin notes", () => read("admin.notes.read", "admin"), "A note"],
		["admin tasks", () => read("admin.tasks.read", "admin"), "A task"],
	]);
});

for (const operation of ["admin.notes.read", "admin.tasks.read"] as const) {
	modulesHost.it(`a visitor cannot call ${operation}`, [], function* ({ read }) {
		expect(yield* read(operation)).toBe("failed with unauthorized");
	});
}

modulesHost.it("a replacement reaches the port bound by both module services", [replacedSource], function* ({ read, replacementCalls }) {
	yield* outcomes([
		["notes", () => read("notes.read"), "Replaced: A note"],
		["tasks", () => read("tasks.read"), "Replaced: A task"],
	]);
	expect((yield* replacementCalls()).toSorted()).toEqual(["A note", "A task"]);
});
