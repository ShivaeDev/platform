import { Effect } from "effect";
import { expect } from "vitest";
import { Forbidden, Unauthorized } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { accessStory, signedIn } from "#test/accessStory.ts";
import { AssignRoles, ReadAllUsers, ReadJobDetails, ReadJobs, ReadUsers } from "#test/policy.ts";

accessStory.it("a role grants exactly its listed permissions and strengths", [signedIn("reader")], function* ({ hasPermission, requirePermission }) {
	expect(hasPermission("reader", ReadUsers)).toBe(true);
	expect(hasPermission("reader", ReadJobs)).toBe(true);
	expect(hasPermission("reader", AssignRoles)).toBe(false);
	expect(hasPermission("reader", ReadAllUsers)).toBe(false);
	expect(hasPermission("reader", ReadJobDetails)).toBe(false);
	expect(hasPermission("manager", ReadAllUsers)).toBe(true);
	expect(hasPermission("manager", ReadUsers)).toBe(false);
	expect(hasPermission("manager", AssignRoles)).toBe(true);
	expect(hasPermission("manager", ReadJobs)).toBe(false);
	expect(hasPermission("guest", ReadUsers)).toBe(false);
	yield* requirePermission(ReadJobs);
});

accessStory.it("a permitted user passes enforcement", [signedIn("reader")], function* ({ requirePermission }) {
	yield* requirePermission(ReadUsers);
});

accessStory.it("a user without a permission is refused", [signedIn("reader")], function* ({ requirePermission }) {
	const failure = yield* requirePermission(AssignRoles).pipe(Effect.flip);
	expect(failure).toBeInstanceOf(Forbidden);
});

accessStory.it("a signed-out caller must sign in", [], function* ({ requirePermission, requireAccess, canAccess }) {
	expect(yield* requirePermission(ReadUsers).pipe(Effect.flip)).toBeInstanceOf(Unauthorized);
	expect(yield* requireAccess(ReadUsers, "alice").pipe(Effect.flip)).toBeInstanceOf(Unauthorized);
	expect(canAccess(ReadUsers, "alice")).toBe(false);
});

accessStory.it("resolving a stored role returns only its declared grants", [], function* ({ resolve }) {
	expect(yield* resolve("manager")).toEqual({
		permissions: [
			{ name: "users.read", strength: "any" },
			{ name: "roles.assign", strength: "own" },
		],
		role: "manager",
	});
	expect(yield* resolve("guest")).toEqual({ permissions: [], role: "guest" });
	expect(yield* resolve("unknown").pipe(Effect.flip)).toMatchObject({
		_tag: "SchemaError",
	});
});
