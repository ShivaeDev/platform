import { expect } from "vitest";
import { providerTeardown } from "#test/rpc/providerTeardown.ts";

for (const owner of ["provider", "scope"] as const) {
	providerTeardown.it(
		`${owner} close waits for every Better Auth client to disconnect`,
		[],
		function* ({
			backends,
			openedBackendIds,
			close,
			databases,
			closeDatabase,
			disconnecting,
			releaseDisconnects,
			shutdownResult,
			waitForShutdown,
			waitForDatabaseCleanup,
		}) {
			const storyDatabase = yield* databases();
			expect((yield* backends()).map(({ pid }) => pid).sort()).toEqual(openedBackendIds());
			const shutdown = yield* close(owner);
			yield* disconnecting();
			expect(yield* shutdownResult(shutdown)).toBeUndefined();
			expect(yield* databases()).toEqual(storyDatabase);
			yield* releaseDisconnects();
			yield* waitForShutdown(shutdown);
			expect(yield* backends()).toEqual([]);
			yield* closeDatabase();
			yield* waitForDatabaseCleanup();
			expect(yield* databases()).toEqual([]);
		},
	);
}
