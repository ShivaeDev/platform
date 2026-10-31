import { expect } from "vitest";
import { allowed, signInPolicy } from "#test/sign-in-policy/story.ts";

for (const entries of ["github:octocat", "github:1001,github:octocat", "github:10.01", "github:-1001", "github:"]) {
	signInPolicy.it(
		`the list ${entries} refuses boot with a config error naming the malformed entry and the numeric GitHub id format`,
		[allowed("alice")],
		function* ({ configureAccounts, restart, startup }) {
			yield* configureAccounts(entries);

			yield* restart();

			const malformedEntry = entries.split(",").at(-1) ?? entries;
			expect(yield* startup()).toMatch(
				new RegExp(`^refused to start: .*${RegExp.escape(malformedEntry)}.*numeric GitHub account id.*digits only.*AUTH_ALLOWED_ACCOUNTS`, "u"),
			);
		},
	);
}

signInPolicy.it(
	"a list with whitespace around alice's numeric GitHub id admits her next request",
	[allowed("alice")],
	function* ({ configureAccounts, request, signIn }) {
		yield* configureAccounts(" github : 1001 ");

		yield* signIn("alice");

		expect(yield* request("alice")).toBe("ok");
	},
);

signInPolicy.it(
	"a provider without a known id format refuses boot when its id is empty",
	[allowed("alice")],
	function* ({ configureAccounts, restart, startup }) {
		yield* configureAccounts("custom-provider:");

		yield* restart();

		expect(yield* startup()).toMatch(/^refused to start: .*custom-provider:.*length.*at least 1.*AUTH_ALLOWED_ACCOUNTS/u);
	},
);

signInPolicy.it(
	"a provider without a known id format accepts an opaque non-empty id at boot",
	[allowed("alice")],
	function* ({ configureAccounts, restart, startup }) {
		yield* configureAccounts("custom-provider:opaque:account-id");

		yield* restart();

		expect(yield* startup()).toBe("started");
	},
);
