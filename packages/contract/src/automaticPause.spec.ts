import { expect } from "vitest";
import { eventually } from "#test/eventually.ts";
import { preferences } from "#test/sessionContract.ts";
import { sessionStory } from "#test/sessionStory.ts";

sessionStory.it("pauses automatic queries across bindings of one client and reconciles current values on resume", [], function* (test) {
	const alice = test.watch("alice", "self");
	test.connect("alice");
	yield* eventually(() => expect(alice.value()).toBe("Alice"));
	test.pause("alice", true);
	yield* test.store("alice", "Written while paused");
	yield* test.announce("alice", [preferences.item(0)]);
	yield* eventually(() => expect(test.status("alice").pending).toBeGreaterThan(0));
	expect(alice.value()).toBe("Alice");
	expect(test.reads("alice", "self")).toEqual(["alice:self"]);
	test.pause("alice", false);
	yield* eventually(() => expect(alice.value()).toBe("Written while paused"));
	expect(test.reads("alice", "self")).toEqual(["alice:self", "alice:self"]);
});
