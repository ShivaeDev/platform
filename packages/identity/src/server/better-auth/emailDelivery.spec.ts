import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceAccount, approvalRequested, bobAccount, deliveryHeld, emails, twoMinuteWindow, twoMounts } from "#test/better-auth/emails.ts";

for (const [kind, path] of [
	["ConfirmAccount", "/confirm-account"],
	["ResetPassword", "/reset-password?from=email"],
	["AccountAlreadyExists", "/sign-in?from=email"],
	["ApproveEmailChange", "/approve-email-change"],
	["ConfirmNewAddress", "/confirm-new-address"],
] as const) {
	const change = kind === "ApproveEmailChange" || kind === "ConfirmNewAddress";
	const traits = [aliceAccount(change), ...(kind === "ConfirmNewAddress" ? [approvalRequested] : [])];
	emails.it(
		`${kind} reaches the app's delivery Effect with its app route${change ? " and new address" : ""}`,
		traits,
		function* ({ request, messages }) {
			yield* request(kind);

			const delivered = yield* messages(kind);
			expect(delivered).toMatchObject([{ _tag: kind }]);
			const message = delivered[0];
			expect(message).toMatchObject({
				_tag: kind,
				...(change ? { newEmail: "alice-new@example.test" } : {}),
				user: { email: kind === "ConfirmNewAddress" ? "alice-new@example.test" : "alice@example.test", name: "alice" },
			});
			const link = new URL(message?.url ?? "");
			if (message !== undefined && "token" in message) {
				expect(message.token.length).toBeGreaterThan(0);
				expect(link.searchParams.get("token")).toBe(message.token);
				link.searchParams.delete("token");
			}
			expect(link.href).toBe(`https://app.example.test${path}`);
		},
	);

	emails.it(
		`${kind} is delivered once across concurrent mounts and both callers return normally`,
		[...traits, twoMounts],
		function* ({ request, messages }) {
			const responses = yield* Effect.all([request(kind), request(kind, "alice", "second")], { concurrency: "unbounded" });

			expect(responses).toEqual([HttpStatus.fromLiteral("OK"), HttpStatus.fromLiteral("OK")]);

			expect(yield* messages(kind)).toMatchObject([{ _tag: kind }]);
		},
	);
}

emails.it("the default window permits another account and another message kind", [aliceAccount(), bobAccount], function* ({ request, messages }) {
	yield* request("ResetPassword");

	yield* request("ResetPassword", "bob");
	yield* request("ConfirmAccount");

	yield* outcomes([
		["password resets", () => messages("ResetPassword"), [{ user: { name: "alice" } }, { user: { name: "bob" } }]],
		["account confirmation", () => messages("ConfirmAccount"), [{ user: { name: "alice" } }]],
	]);
});

for (const [traits, label] of [
	[[], "default"],
	[[twoMinuteWindow], "configured"],
] as const) {
	emails.it(`an expired ${label} email window permits delivery again`, [...traits, aliceAccount()], function* ({ request, messages, expireWindows }) {
		yield* request("ResetPassword");
		expect(yield* messages("ResetPassword")).toMatchObject([{ _tag: "ResetPassword" }]);

		yield* expireWindows();
		yield* request("ResetPassword");

		expect(yield* messages("ResetPassword")).toMatchObject([{ _tag: "ResetPassword" }, { _tag: "ResetPassword" }]);
	});
}

emails.it(
	"a rebuilt mount suppresses delivery and returns normally within the window",
	[aliceAccount()],
	function* ({ request, messages, rebuildMount }) {
		yield* request("ResetPassword");
		expect(yield* messages("ResetPassword")).toMatchObject([{ user: { name: "alice" } }]);

		yield* rebuildMount();
		const response = yield* request("ResetPassword");

		expect(response).toBe(HttpStatus.fromLiteral("OK"));
		expect(yield* messages("ResetPassword")).toMatchObject([{ user: { name: "alice" } }]);
	},
);

emails.it(
	"changing the destination cannot bypass the account's approval window",
	[aliceAccount(true)],
	function* ({ request, changeEmailTo, messages }) {
		yield* request("ApproveEmailChange");

		yield* changeEmailTo("alice-other@example.test");

		expect(yield* messages("ApproveEmailChange")).toMatchObject([{ newEmail: "alice-new@example.test" }]);
	},
);

emails.it(
	"a failed delivery reserves its window until expiry",
	[aliceAccount()],
	function* ({ deliveryAvailable, request, messages, expireWindows }) {
		yield* deliveryAvailable(false);
		yield* request("ResetPassword");
		expect(yield* messages("ResetPassword")).toEqual([]);
		yield* deliveryAvailable(true);

		yield* request("ResetPassword");

		expect(yield* messages("ResetPassword")).toEqual([]);
		yield* expireWindows();
		yield* request("ResetPassword");
		expect(yield* messages("ResetPassword")).toMatchObject([{ _tag: "ResetPassword" }]);
	},
);

emails.it(
	"an in-flight delivery reserves the account's window",
	[aliceAccount(), deliveryHeld],
	function* ({ beginRequest, request, finishDelivery, messages }) {
		yield* beginRequest("ResetPassword");

		yield* request("ResetPassword");

		expect(yield* messages("ResetPassword")).toEqual([]);
		yield* finishDelivery();
		expect(yield* messages("ResetPassword")).toMatchObject([{ _tag: "ResetPassword" }]);
	},
);
