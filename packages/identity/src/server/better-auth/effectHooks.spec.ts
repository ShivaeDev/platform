import { Effect } from "effect";
import { expect } from "vitest";
import { atLeast } from "@shivaedev/test-story/server/adapters/outcomeMatchers.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	defectiveHook,
	effectHooks,
	nativeRefusal,
	passwordAccounts,
	refusingPolicy,
	unchangedUserHook,
	userHooks,
	waitingHook,
} from "#test/better-auth/effectHooks.ts";

effectHooks.it(
	"the application's Effect refuses bob's sign-in with its code and creates no session",
	[passwordAccounts],
	function* ({ signIn, storedSessions }) {
		const response = yield* signIn("bob");

		yield* outcomes([
			["refusal", () => Effect.succeed(response), { code: "MEMBERS_ONLY", message: "Membership is required", status: 403 }],
			["stored sessions", () => storedSessions(), []],
		]);
	},
);

effectHooks.it("the application's Effect reads the request service to admit alice's sign-in", [passwordAccounts], function* ({ signIn, session }) {
	const response = yield* signIn("alice");

	yield* outcomes([
		["sign-in", () => Effect.succeed(response), { status: 200 }],
		["session", () => session(), { email: "alice@hooks.test", name: "alice" }],
	]);
});

effectHooks.it("direct auth.api calls use the mount's admission service", [passwordAccounts], function* ({ directSignIn }) {
	const response = yield* directSignIn("alice");

	expect(response).toEqual({ code: "MEMBERS_ONLY", message: "Membership is required", status: 403 });
});

effectHooks.it("each sign-in supplies its own admission service", [passwordAccounts], function* ({ signIn, session }) {
	expect(yield* signIn("bob")).toMatchObject({ code: "MEMBERS_ONLY" });

	yield* signIn("bob", "bob");

	expect(yield* session()).toEqual({ email: "bob@hooks.test", name: "bob" });
});

effectHooks.it(
	"the application hook inherits the HTTP request's span and log annotations",
	[passwordAccounts],
	function* ({ signIn, hookLogs, hookSpans }) {
		yield* signIn("alice");

		const logs = yield* hookLogs();
		yield* outcomes([
			["hook logs", () => Effect.succeed(logs), [{ requestId: "application-sign-in", traceId: expect.stringMatching(/^[a-f\d]{32}$/u) }]],
			["hook spans", () => hookSpans(), [{ parent: "POST", traceId: logs[0]?.traceId ?? "" }]],
		]);
	},
);

effectHooks.it(
	"cancelling sign-in interrupts the application's waiting Effect",
	[passwordAccounts, waitingHook],
	function* ({ cancelSignIn, hookInterrupted }) {
		yield* cancelSignIn("alice");

		expect(yield* hookInterrupted()).toBe("interrupted");
	},
);

effectHooks.it(
	"an application hook defect reaches the request as a defect",
	[passwordAccounts, defectiveHook],
	function* ({ signIn, requestDefects }) {
		yield* signIn("alice");

		expect(yield* requestDefects()).toEqual(["Error: Application session hook broke"]);
	},
);

effectHooks.it(
	"user Effects compose with native transformations and observe the created user",
	[userHooks],
	function* ({ signUp, session, userCreations }) {
		const response = yield* signUp("alice");

		yield* outcomes([
			["sign-up", () => Effect.succeed(response), { status: 200 }],
			["session", () => session(), { email: "alice@hooks.test", name: "native alice admitted" }],
			["recorded user creations", () => userCreations(), [["Application user created", "native alice admitted"]]],
		]);
	},
);

effectHooks.it(
	"identity's sign-in policy still refuses a session admitted by the application's Effect",
	[passwordAccounts, refusingPolicy],
	function* ({ signIn, session }) {
		const response = yield* signIn("alice");

		yield* outcomes([
			["policy refusal", () => Effect.succeed(response), { code: "sign_in_refused", message: "This account may not sign in", status: 403 }],
			["session", () => session(), "signed out"],
		]);
	},
);

effectHooks.it(
	"an Effect returning true preserves the native hook's user transformation",
	[userHooks, unchangedUserHook],
	function* ({ signUp, session }) {
		yield* signUp("alice");

		expect(yield* session()).toEqual({ email: "alice@hooks.test", name: "native alice" });
	},
);

effectHooks.it(
	"a native hook refusal prevents the application Effect and session creation",
	[passwordAccounts, nativeRefusal],
	function* ({ signIn, storedSessions, hookLogs }) {
		const response = yield* signIn("alice");

		yield* outcomes([
			["refused sign-in", () => Effect.succeed(response.status), atLeast(400)],
			["stored sessions", () => storedSessions(), []],
			["admission logs", () => hookLogs(), []],
		]);
	},
);
