import { Effect } from "effect";
import { expect } from "vitest";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { accessStory, signedIn } from "#test/accessStory.ts";
import { ReadUsers } from "#test/policy.ts";

accessStory.it("an owner can act on their record with the default strength", [signedIn("reader")], function* ({ canAccess, requireAccess }) {
	expect(canAccess(ReadUsers, "alice")).toBe(true);
	yield* requireAccess(ReadUsers, "alice");
});

accessStory.it("the default strength cannot act on another owner's record", [signedIn("reader")], function* ({ canAccess, requireAccess }) {
	expect(canAccess(ReadUsers, "bob")).toBe(false);
	expect(yield* requireAccess(ReadUsers, "bob").pipe(Effect.flip)).toBeInstanceOf(Forbidden);
});

accessStory.it("the override can act on records with either owner", [signedIn("manager")], function* ({ canAccess, requireAccess }) {
	expect(canAccess(ReadUsers, "alice")).toBe(true);
	expect(canAccess(ReadUsers, "bob")).toBe(true);
	yield* requireAccess(ReadUsers, "alice");
	yield* requireAccess(ReadUsers, "bob");
});

accessStory.it("ownership alone grants no permission", [signedIn("guest")], function* ({ canAccess, requireAccess }) {
	expect(canAccess(ReadUsers, "alice")).toBe(false);
	expect(yield* requireAccess(ReadUsers, "alice").pipe(Effect.flip)).toBeInstanceOf(Forbidden);
});
