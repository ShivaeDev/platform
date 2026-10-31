import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { roleManagement } from "#test/better-auth/roleManagement.ts";

for (const actor of ["alice", "bob", "visitor"] as const) {
	for (const endpoint of ["set-role", "update-user", "create-user"] as const) {
		roleManagement.it(
			`${actor}'s /admin/${endpoint} request is closed and leaves users' roles unchanged`,
			[],
			function* ({ requestRoleEndpoint, rolesOnUsersPage }) {
				expect(yield* rolesOnUsersPage()).toEqual({ alice: "admin", bob: "user" });

				const status = yield* requestRoleEndpoint(actor, endpoint);

				yield* outcomes([
					["closed endpoint", () => Effect.succeed(status), HttpStatus.fromLiteral("NotFound")],
					["roles on the users page", () => rolesOnUsersPage(), { alice: "admin", bob: "user" }],
				]);
			},
		);
	}
}

roleManagement.it("alice can still change bob's role through the users page", [], function* ({ changeOnUsersPage, sessionRole }) {
	expect(yield* sessionRole("bob")).toBe("user");

	yield* changeOnUsersPage("bob", "delegate");

	expect(yield* sessionRole("bob")).toBe("delegate");
});

roleManagement.it("an operator seed assigns bob's role through identity", [], function* ({ seedRole, sessionRole }) {
	expect(yield* sessionRole("bob")).toBe("user");

	yield* seedRole("bob", "delegate");

	expect(yield* sessionRole("bob")).toBe("delegate");
});

roleManagement.it("assignRole refuses to remove the last role assigner and preserves alice's role", [], function* ({ seedRole, sessionRole }) {
	const answer = yield* seedRole("alice", "user");

	yield* outcomes([
		["alice's session role", () => sessionRole("alice"), "admin"],
		["assignment refusal", () => Effect.succeed(answer), "last role assigner"],
	]);
});

roleManagement.it("concurrent operator assignments leave one role assigner", [], function* ({ seedRole, sessionRole }) {
	yield* seedRole("bob", "delegate");

	const answers = yield* Effect.all([seedRole("alice", "user"), seedRole("bob", "user")], { concurrency: "unbounded" });

	yield* outcomes([
		["assignment answers", () => Effect.succeed(answers.sort()), ["assigned", "last role assigner"]],
		[
			"remaining role assigner",
			() =>
				Effect.all({ alice: sessionRole("alice"), bob: sessionRole("bob") }).pipe(
					Effect.map((roles) =>
						Object.entries(roles)
							.filter(([, role]) => role !== "user")
							.map(([person]) => person)
							.join(", "),
					),
				),
			expect.stringMatching(/^(?:alice|bob)$/u),
		],
	]);
});

roleManagement.it("mounting roles keeps the app's disabled profile endpoint closed", [], function* ({ updateProfile }) {
	const status = yield* updateProfile();

	expect(status).toBe(HttpStatus.fromLiteral("NotFound"));
});

roleManagement.it("assignRole reports an unchanged role when a seed repeats alice's current role", [], function* ({ seedRole }) {
	const answer = yield* seedRole("alice", "admin");

	expect(answer).toBe("unchanged");
});
