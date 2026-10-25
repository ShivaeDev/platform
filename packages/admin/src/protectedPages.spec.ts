import { Effect, Layer } from "effect";
import { expect } from "vitest";
import { Jobs, JobsContract, Users } from "#test/pages.ts";
import { adminStory, registrationStory, signedIn } from "#test/story.ts";

for (const [label, traits, error] of [
	["signed out", [], "Unauthorized"],
	["a member", [signedIn("user")], "Forbidden"],
	["an owner without admin", [signedIn("owner")], "Forbidden"],
] as const) {
	adminStory.it(
		`refuses ${label} on every operation and generated subscription`,
		traits,
		function* ({ failed, retry, watch, changes, profile, userChanges }) {
			expect(yield* Effect.flip(failed())).toMatchObject({ _tag: error });
			expect(yield* Effect.flip(retry("mail-42"))).toMatchObject({ _tag: error });
			expect(yield* Effect.flip(watch())).toMatchObject({ _tag: error });
			expect(yield* Effect.flip(changes())).toMatchObject({ _tag: error });
			expect(yield* Effect.flip(profile())).toMatchObject({ _tag: error });
			expect(yield* Effect.flip(userChanges())).toMatchObject({ _tag: error });
		},
	);
}

adminStory.it(
	"serves admin queries, commands, streams and generated subscriptions",
	[signedIn("admin")],
	function* ({ failed, retry, watch, changes, profile, userChanges }) {
		expect(yield* failed()).toEqual(["mail-42"]);
		expect(yield* watch()).toEqual([["mail-42"]]);
		expect(yield* profile()).toBe("operator@example.test");
		expect(yield* changes()).toEqual([{ _tag: "Resync" }]);
		expect(yield* userChanges()).toEqual([{ _tag: "Resync" }]);
		yield* retry("mail-42");
		expect(yield* failed()).toEqual([]);
		expect(Jobs.contract.declaration).toBe(JobsContract.declaration);
		expect(Users.contract.declaration.commands).toEqual([]);
		expect([...Users.contract.requests.keys()]).toEqual(["admin.users.profile", "admin.users.$changes"]);
	},
);

for (const kind of ["id", "path", "tag"] as const) {
	registrationStory.it(`rejects a duplicate page ${kind} before merging RPCs`, [], function* ({ duplicate }) {
		const labels = { id: "page id", path: "path", tag: "RPC tag" };
		expect(() => duplicate(kind)).toThrow(`Duplicate admin ${labels[kind]}`);
	});
}

registrationStory.it("rejects missing and unregistered handler pages", [], function* ({ register }) {
	expect(() => register({})).toThrow("Missing admin handlers: jobs");
	expect(() => register({ jobs: Layer.empty })).toThrow("Missing admin handlers: users");
	expect(() => register({ jobs: Layer.empty, other: Layer.empty, users: Layer.empty })).toThrow("Unregistered admin handlers: other");
});

registrationStory.it("rejects colliding generated subscriptions", [], function* ({ duplicate }) {
	expect(() => duplicate("changes")).toThrow("Duplicate admin RPC tag: admin.jobs.$changes");
});
