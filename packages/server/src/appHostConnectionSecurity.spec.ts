import { expect } from "vitest";
import { databaseConnection } from "#test/app-host/databaseConnection.ts";
import { postgresHost } from "#test/app-host/story.ts";

postgresHost.it("an unset sslmode connects the host's database in plain text", [databaseConnection(undefined)], function* ({ connectionSecurity }) {
	expect(yield* connectionSecurity()).toBe("plain text");
});

postgresHost.it(
	"sslmode=require connects the host's database only over TLS, or refuses startup when the server lacks TLS",
	[databaseConnection("require")],
	function* ({ connectionSecurity, serverOffersTls }) {
		expect(yield* connectionSecurity()).toBe((yield* serverOffersTls()) ? "TLS" : "refused because the server lacks TLS");
	},
);
