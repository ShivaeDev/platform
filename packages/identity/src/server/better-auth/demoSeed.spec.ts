import { Effect, Redacted } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { demoSeedStory } from "#test/demo-seed/story.ts";

demoSeedStory.it("running the seed twice keeps alice and bob once with the same IDs and assigned roles", [], function* ({ run, storedUsers }) {
	yield* run();
	const first = yield* storedUsers();
	expect(first).toMatchObject([
		{ email: "alice@demo.test", name: "alice", role: "owner" },
		{ email: "bob@demo.test", name: "bob", role: "reader" },
	]);

	yield* run();

	expect(yield* storedUsers()).toEqual(first);
});

demoSeedStory.it(
	"each seed run receives alice's and bob's own identity, query viewer, profile and role grants",
	[],
	function* ({ run, runs, storedUsers }) {
		yield* run();

		yield* run();

		const users = yield* storedUsers();
		expect(yield* runs()).toEqual(
			[...users, ...users].map(({ id, email, name, role }) => ({
				email,
				id,
				identityId: id,
				name,
				permissions: role === "owner" ? [{ name: "roles.assign", strength: "own" }] : [],
				role,
				viewerId: id,
			})),
		);
	},
);

demoSeedStory.it("a rerun restores bob's declared reader role after he was promoted to owner", [], function* ({ run, promoteBob, storedUsers }) {
	yield* run();
	yield* promoteBob();
	expect(yield* storedUsers()).toMatchObject([{ role: "owner" }, { email: "bob@demo.test", role: "owner" }]);

	yield* run();

	expect(yield* storedUsers()).toMatchObject([{ role: "owner" }, { email: "bob@demo.test", role: "reader" }]);
});

for (const target of [
	"postgresql://demo:password@database.example.test/demo",
	"postgresql://demo:password@127.0.0.1/demo?host=database.example.test",
	"postgresql://demo:password@localhost/demo?hostaddr=192.0.2.1",
	"postgresql://demo:password@localhost/demo?service=production",
	"https://localhost/demo",
	"not-a-database-url",
]) {
	demoSeedStory.it(`refuses the unsafe demo database URL ${target} before provisioning or run`, [], function* ({ run, runs, storedUsers }) {
		const answer = yield* run(target);

		yield* outcomes([
			["seed refusal", () => Effect.succeed(answer), "Demo seeding requires a local PostgreSQL database URL"],
			["stored users", () => storedUsers(), []],
			["application runs", () => runs(), []],
		]);
	});
}

demoSeedStory.it(
	"alice and bob retain their names and can sign in with their demo passwords after a rerun changes both declarations",
	[],
	function* ({ run, signIn }) {
		yield* run();

		yield* run(undefined, Redacted.make("a-different-demo-password"), " renamed");

		yield* outcomes([
			["alice signs in", () => signIn("alice@demo.test"), { email: "alice@demo.test", name: "alice" }],
			["bob signs in", () => signIn("bob@demo.test"), { email: "bob@demo.test", name: "bob" }],
		]);
	},
);
