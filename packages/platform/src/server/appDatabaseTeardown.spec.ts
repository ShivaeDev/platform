import { expect } from "vitest";
import { poolTeardown } from "#test/app-host/poolTeardown.ts";

poolTeardown.it(
	"waits for query and listener sockets to disconnect before its scope closes",
	[],
	function* ({ backends, close, disconnecting, releaseDisconnects, shutdownResult, waitForShutdown }) {
		const queryAndListenerConnections = 2;
		expect(yield* backends()).toHaveLength(queryAndListenerConnections);
		const shutdown = yield* close();
		yield* disconnecting();
		expect(yield* shutdownResult(shutdown)).toBeUndefined();
		yield* releaseDisconnects();
		yield* waitForShutdown(shutdown);
		expect(yield* backends()).toEqual([]);
	},
);
