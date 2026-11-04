import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceAccount, differentWindows, emails } from "#test/better-auth/emails.ts";

emails.it(
	"each kind resumes after its own window, with unlisted kinds using the default",
	[differentWindows, aliceAccount()],
	function* ({ request, messages, emailWindowPasses }) {
		for (const kind of ["ConfirmAccount", "AccountAlreadyExists", "ResetPassword"] as const) {
			yield* request(kind);
			yield* request(kind);
		}
		yield* outcomes([
			["confirmation throttled", () => messages("ConfirmAccount"), [{ _tag: "ConfirmAccount" }]],
			["duplicate signup throttled", () => messages("AccountAlreadyExists"), [{ _tag: "AccountAlreadyExists" }]],
			["reset throttled", () => messages("ResetPassword"), [{ _tag: "ResetPassword" }]],
		]);

		yield* emailWindowPasses("150 seconds");
		for (const kind of ["ConfirmAccount", "AccountAlreadyExists", "ResetPassword"] as const) {
			yield* request(kind);
		}
		yield* outcomes([
			["two minute confirmation resumed", () => messages("ConfirmAccount"), [{ _tag: "ConfirmAccount" }, { _tag: "ConfirmAccount" }]],
			["three minute default still throttled", () => messages("AccountAlreadyExists"), [{ _tag: "AccountAlreadyExists" }]],
			["four minute reset still throttled", () => messages("ResetPassword"), [{ _tag: "ResetPassword" }]],
		]);

		yield* emailWindowPasses("60 seconds");
		yield* request("AccountAlreadyExists");
		yield* request("ResetPassword");
		yield* outcomes([
			["three minute default resumed", () => messages("AccountAlreadyExists"), [{ _tag: "AccountAlreadyExists" }, { _tag: "AccountAlreadyExists" }]],
			["four minute reset still throttled", () => messages("ResetPassword"), [{ _tag: "ResetPassword" }]],
		]);

		yield* emailWindowPasses("60 seconds");
		yield* request("ResetPassword");

		expect(yield* messages("ResetPassword")).toMatchObject([{ _tag: "ResetPassword" }, { _tag: "ResetPassword" }]);
	},
);
