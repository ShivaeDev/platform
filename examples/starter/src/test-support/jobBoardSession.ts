import { type BetterAuthOptions, betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { authDatabase } from "@shivaedev/platform/better-auth.ts";
import { authOptions } from "#server/authOptions.ts";

export const jobBoardSession = Effect.fn("JobBoardStory.jobBoardSession")(function* (role: "admin" | "user") {
	const database = yield* PostgresTestDatabase;
	const pool = yield* authDatabase(database.url);
	const testing = testUtils();
	const options = {
		...authOptions(pool),
		plugins: [
			...authOptions(pool).plugins,
			{
				...testing,
				init(context) {
					const result = testing.init(context);
					return { context: result.context, ...(result.options === undefined ? {} : { options: result.options }) };
				},
			},
		],
		secret: "app-test-secret-with-at-least-32-characters",
	} satisfies BetterAuthOptions;
	// Mint the signed-in precondition without exercising password hashing in dashboard stories.
	const { test } = yield* Effect.promise(() => betterAuth(options).$context);
	const user = yield* Effect.promise(() => test.saveUser(test.createUser({ email: `${role}@app.test`, role })));
	const headers = yield* Effect.promise(() => test.getAuthHeaders({ userId: user.id }));
	return headers.get("cookie") ?? "";
});
