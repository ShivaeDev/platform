import { expect } from "vitest";
import { providerTeardown, twoClientsConnected } from "#test/rpc/providerTeardown.ts";

providerTeardown.it(
	"closing the auth database's scope keeps waiting while PostgreSQL has not acknowledged its clients' disconnects",
	[twoClientsConnected],
	function* ({ closeProgress, closeScope }) {
		yield* closeScope();

		expect(yield* closeProgress()).toBe("waiting");
	},
);

providerTeardown.it(
	"once PostgreSQL acknowledges the disconnects, closing the auth database's scope finishes",
	[twoClientsConnected],
	function* ({ acknowledgeDisconnects, closeOutcome, closeProgress, closeScope }) {
		yield* closeScope();
		expect(yield* closeProgress()).toBe("waiting");

		yield* acknowledgeDisconnects();

		expect(yield* closeOutcome()).toBe("closed");
	},
);
