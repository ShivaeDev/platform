import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { generated } from "#test/traits.ts";

application.it(
	"create-app my-app points .env.local's DATABASE_URL and TEST_DATABASE_URL at my_app_dev and my_app_test on the local PostgreSQL",
	[],
	function* ({ createApp, environmentSetting }) {
		yield* createApp("my-app", "--no-git");

		yield* outcomes({
			"DATABASE_URL": [environmentSetting("DATABASE_URL"), "postgresql://postgres:postgres@127.0.0.1:55432/my_app_dev"],
			"TEST_DATABASE_URL": [environmentSetting("TEST_DATABASE_URL"), "postgresql://postgres:postgres@127.0.0.1:55432/my_app_test"],
		});
	},
);

application.it(
	"a second app gets its own BETTER_AUTH_SECRET of 32 random bytes in base64url",
	[generated("first/my-app", "--no-git")],
	function* ({ authSecret, createApp }) {
		const first = yield* authSecret();
		expect(first).toMatch(/^[\w-]{43}$/u);

		yield* createApp("second/my-app", "--no-git");

		const second = yield* authSecret();
		expect(second).toMatch(/^[\w-]{43}$/u);
		expect(second).not.toBe(first);
	},
);
