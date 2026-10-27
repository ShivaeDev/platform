import { Effect } from "effect";
import { expect } from "vitest";
import { usersStory } from "#test/usersStory.ts";

usersStory.it("role assignment changes the target's access on the next request", [], function* ({ list, assign }) {
	expect(yield* Effect.flip(list("bob"))).toMatchObject({ _tag: "Forbidden" });
	yield* assign("alice", "bob", "auditor");
	expect((yield* list("bob")).users).toContainEqual(expect.objectContaining({ id: "bob", role: "auditor" }));
	expect(yield* Effect.flip(assign("bob", "carol", "owner"))).toMatchObject({ _tag: "Forbidden" });
	yield* assign("alice", "bob", "user");
	expect(yield* Effect.flip(list("bob"))).toMatchObject({ _tag: "Forbidden" });
});

usersStory.it("refuses to remove the last holder of roles.assign", [], function* ({ assign, list }) {
	expect(yield* Effect.flip(assign("alice", "alice", "admin"))).toMatchObject({ _tag: "LastRoleAssigner", userId: "alice" });
	expect((yield* list("alice")).users).toContainEqual(expect.objectContaining({ id: "alice", role: "owner" }));
	yield* assign("alice", "bob", "delegate");
	yield* assign("alice", "alice", "admin");
	expect(yield* Effect.flip(assign("alice", "carol", "user"))).toMatchObject({ _tag: "Forbidden" });
	yield* assign("bob", "carol", "operator");
	expect((yield* list("bob")).users).toContainEqual(expect.objectContaining({ id: "carol", role: "operator" }));
});

usersStory.it("the final assigner is protected regardless of its role's name", [], function* ({ assign }) {
	yield* assign("alice", "bob", "delegate");
	yield* assign("alice", "alice", "admin");
	expect(yield* Effect.flip(assign("bob", "bob", "auditor"))).toMatchObject({ _tag: "LastRoleAssigner", userId: "bob" });
});
