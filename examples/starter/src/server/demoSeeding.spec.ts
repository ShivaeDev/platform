import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminSetup } from "#test-support/admin/setup.ts";

adminSetup.it(
	"the db:seed script creates demo accounts that sign in with their owner and user roles after a rerun",
	[],
	function* ({ seedCommandRuns, appStarts, signsIn, signedInAccount }) {
		const first = yield* seedCommandRuns();

		const repeated = yield* seedCommandRuns();

		yield* outcomes([
			["first seed exit code", () => Effect.succeed(first), 0],
			["repeated seed exit code", () => Effect.succeed(repeated), 0],
		]);

		yield* appStarts();
		for (const [email, name, role] of [
			["owner@demo.test", "Demo Owner", "owner"],
			["user@demo.test", "Demo User", "user"],
		] as const) {
			const answer = yield* signsIn(email, "local-demo-password");

			yield* outcomes([
				["sign-in response", () => Effect.succeed(answer), "signed in"],
				["signed-in account", () => signedInAccount(), { email, name, role }],
			]);
		}
	},
);
