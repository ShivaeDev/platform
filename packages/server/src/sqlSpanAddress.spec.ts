import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { databaseAddress } from "#test/app-host/databaseAddress.ts";
import { nativeTracing } from "#test/app-host/nativeTracing.ts";
import { hostOptions } from "#test/app-host/story.ts";

const host = storyKit(hostOptions({ database: true }));

for (const source of ["authority", "parameters"] as const) {
	host.it(
		`the host reaches the server named by the DATABASE_URL ${source} and keeps the URL redacted`,
		[databaseAddress(source), nativeTracing],
		function* ({ queryThroughHost, referenceConnection }) {
			const reference = yield* referenceConnection();

			expect(yield* queryThroughHost()).toEqual({ rows: reference, url: "redacted" });
		},
	);

	host.it(
		`SQL spans name the DATABASE_URL ${source} host and port`,
		[databaseAddress(source), nativeTracing],
		function* ({ databasePort, queryThroughHost, sqlSpanDestination }) {
			const port = yield* databasePort();

			yield* queryThroughHost();

			expect(yield* sqlSpanDestination()).toEqual({ address: "127.0.0.1", port });
		},
	);

	host.it(
		`SQL spans carry neither the DATABASE_URL ${source} nor its credentials`,
		[databaseAddress(source), nativeTracing],
		function* ({ queryThroughHost, sqlSpanDestination, sqlSpanSecrets }) {
			yield* queryThroughHost();

			yield* outcomes({
				"leaked secrets": [sqlSpanSecrets(), []],
				"recorded SQL span": [sqlSpanDestination(), expect.objectContaining({ address: "127.0.0.1" })],
			});
		},
	);
}
