import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { confirmationFails, connections, restartFails, stockContainer } from "#test/connections.ts";

connections.it(
	"a failed restart returns PostgresSettingError with the restart diagnostic and leaves the same container running",
	[stockContainer(), restartFails()],
	function* ({ container, outcome, start }) {
		yield* start();

		yield* outcomes([
			["failure", () => outcome(), "max_connections refused in development-postgres: Docker refused to restart the container"],
			["container", () => container(), "the same container, still running"],
		]);
	},
);

connections.it(
	"a failed connection-limit check after restart returns PostgresSettingError with the check diagnostic after restarting the same container",
	[stockContainer(), confirmationFails()],
	function* ({ container, outcome, start }) {
		yield* start();

		yield* outcomes([
			["failure", () => outcome(), "max_connections refused in development-postgres: PostgreSQL refused the connection-limit check"],
			["container", () => container(), "the same container, restarted"],
		]);
	},
);
