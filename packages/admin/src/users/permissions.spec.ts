import { Clock, Effect, Exit, Option } from "effect";
import { expect } from "vitest";
import { isRegistered, usersStory } from "#test/usersStory.ts";

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

usersStory.it("changing the role of a missing user fails with NotFound", [], function* ({ assign }) {
	expect(yield* Effect.flip(assign("alice", "nobody", "auditor"))).toMatchObject({ _tag: "NotFound" });
});

usersStory.it("a role change logs the actor, target, role and time", [], function* ({ assign, logs }) {
	const before = yield* Clock.currentTimeMillis;
	yield* assign("alice", "bob", "auditor");
	const changes = logs().filter(({ message }) => JSON.stringify(message).includes("User role changed"));
	expect(changes).toEqual([
		{ annotations: expect.objectContaining({ actorId: "alice", role: "auditor", userId: "bob" }), message: ["User role changed"] },
	]);
	const changedAt = Date.parse(String(changes[0]?.annotations.changedAt));
	expect(changedAt).toBeGreaterThanOrEqual(before);
	expect(changedAt).toBeLessThanOrEqual(yield* Clock.currentTimeMillis);
});

usersStory.it("lists pages of 1 to 100 users ordered by user id", [isRegistered("aaron", "user")], function* ({ list }) {
	const first = yield* list("alice", { limit: 2 });
	expect(first.users.map(({ id }) => id)).toEqual(["aaron", "alice"]);
	expect(first.next).toEqual(Option.some("alice"));
	const rest = yield* list("alice", { cursor: "alice", limit: 2 });
	expect(rest.users.map(({ id }) => id)).toEqual(["bob", "carol"]);
	expect(rest.next).toEqual(Option.none());
	expect((yield* list("alice", { limit: 1 })).users.map(({ id }) => id)).toEqual(["aaron"]);
	expect((yield* list("alice", { limit: 100 })).users.map(({ id }) => id)).toEqual(["aaron", "alice", "bob", "carol"]);
	for (const limit of [0, 101, 1.5]) {
		expect(Exit.isFailure(yield* Effect.exit(list("alice", { limit })))).toBe(true);
	}
});
