import { expect } from "vitest";
import { poolTeardown } from "#test/app-host/poolTeardown.ts";

poolTeardown.it(
	"waits for query and listener sockets to disconnect before its scope closes",
	[],
	function* ({ backendQueries, backends, close, disconnecting, releaseDisconnects, shutdownResult, waitForShutdown }) {
		expect(yield* backendQueries()).toEqual([{ query: expect.stringMatching(/^LISTEN /u) }, { query: "select 1" }]);
		const shutdown = yield* close();
		yield* disconnecting();
		expect(yield* shutdownResult(shutdown)).toBeUndefined();
		yield* releaseDisconnects();
		yield* waitForShutdown(shutdown);
		expect(yield* backends()).toEqual([]);
	},
);
