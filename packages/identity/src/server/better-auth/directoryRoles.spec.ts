import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { LastRoleAssigner } from "#roles.ts";
import {
	directoryAccounts,
	mappedUserDirectory,
	pluginMappedUserDirectory,
	standaloneUserDirectory,
	userDirectory,
} from "#test/better-auth/userDirectory.ts";

for (const [kit, mapping] of [
	[userDirectory, "default"],
	[mappedUserDirectory, "custom"],
	[pluginMappedUserDirectory, "plugin"],
] as const) {
	kit.it(`assigns and reads roles with ${mapping} auth mappings`, [directoryAccounts], function* ({ assignRole, role }) {
		expect(yield* role("bob")).toBe("member");

		const assignment = yield* assignRole("bob", "delegate");

		yield* outcomes([
			["changed role", () => Effect.succeed(assignment), "assigned"],
			["stored role", () => role("bob"), "delegate"],
		]);
	});

	kit.it(`refuses to remove the final role assigner with ${mapping} auth mappings`, [directoryAccounts], function* ({ assignRole, role }) {
		const result = yield* assignRole("alice", "member");

		expect(result).toBeInstanceOf(LastRoleAssigner);
		expect(result).toMatchObject({ userId: "alice" });
		expect(yield* role("alice")).toBe("assigner");
	});

	kit.it(
		`publishes user and role changes with ${mapping} auth mappings`,
		[directoryAccounts],
		function* ({ assignRole, watchUsers, watchRole, nextChange }) {
			const users = yield* watchUsers();
			const bob = yield* watchRole("bob");
			yield* outcomes([
				["initial users", () => nextChange(users).pipe(Effect.map((page) => page.users.find(({ id }) => id === "bob")?.role)), "member"],
				["initial role", () => nextChange(bob), "member"],
			]);

			yield* assignRole("bob", "delegate");

			yield* outcomes([
				["refreshed users", () => nextChange(users).pipe(Effect.map((page) => page.users.find(({ id }) => id === "bob")?.role)), "delegate"],
				["refreshed role", () => nextChange(bob), "delegate"],
			]);
		},
	);
}

userDirectory.it("assigning an existing role reports no change", [directoryAccounts], function* ({ assignRole }) {
	expect(yield* assignRole("alice", "assigner")).toBe("unchanged");
});

userDirectory.it("a different assignment role allows the previous assigner's demotion", [directoryAccounts], function* ({ assignRole, role }) {
	yield* assignRole("bob", "delegate");

	const answer = yield* assignRole("alice", "member");

	yield* outcomes([
		["assignment", () => Effect.succeed(answer), "assigned"],
		["demoted assigner", () => role("alice"), "member"],
		["remaining assigner", () => role("bob"), "delegate"],
	]);
});

userDirectory.it("assignment to a missing user has a typed failure", [], function* ({ assignRole }) {
	expect(yield* assignRole("absent", "member")).toBe("user not found");
});

userDirectory.it("an application rollback preserves the role and publishes no changes", [directoryAccounts], function* ({ rollbackRole, role }) {
	const answer = yield* rollbackRole("bob", "delegate");

	yield* outcomes([
		["transaction result", () => Effect.succeed(answer), { published: [], reason: "cancelled assignment" }],
		["preserved role", () => role("bob"), "member"],
	]);
});

userDirectory.it("competing demotions preserve a role assigner", [directoryAccounts], function* ({ assignRole, role }) {
	yield* assignRole("bob", "delegate");

	const results = yield* Effect.all([assignRole("alice", "member"), assignRole("bob", "member")], { concurrency: "unbounded" });

	expect(results.filter((result) => typeof result === "string")).toEqual(["assigned"]);
	expect(results.filter((result) => result instanceof LastRoleAssigner)).toEqual([expect.any(LastRoleAssigner)]);
	const roles = yield* Effect.all([role("alice"), role("bob")]);
	expect(roles.filter((stored) => stored !== "member")).toEqual([expect.stringMatching(/^(?:assigner|delegate)$/u)]);
});

userDirectory.it("undeclared assignment roles fail without changing the user", [directoryAccounts], function* ({ assignRole, role }) {
	const result = yield* assignRole("bob", "unknown");

	yield* outcomes([
		["typed refusal", () => Effect.succeed(result), "auth unavailable"],
		["preserved role", () => role("bob"), "member"],
	]);
});

standaloneUserDirectory.it(
	"server-only callers assign roles without an ambient Reactivity service",
	[directoryAccounts],
	function* ({ assignRole, role }) {
		const result = yield* assignRole("bob", "delegate");

		yield* outcomes([
			["changed role", () => Effect.succeed(result), "assigned"],
			["stored role", () => role("bob"), "delegate"],
		]);
	},
);
