import { expect } from "vitest";
import { declaredSetting, postgresSettings } from "#test/postgres-settings/story.ts";

postgresSettings.it(
	"database startup without Railway deployment variables leaves PostgreSQL settings unchanged",
	[declaredSetting],
	function* ({ liveSetting, start }) {
		const before = yield* liveSetting("log_min_duration_sample");

		yield* start();

		expect(yield* liveSetting("log_min_duration_sample")).toEqual(before);
	},
);
