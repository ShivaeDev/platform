import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { databaseAddress } from "#test/app-host/databaseAddress.ts";
import { nativeTracing } from "#test/app-host/nativeTracing.ts";
import { hostOptions } from "#test/app-host/story.ts";

const host = storyKit(hostOptions({ database: true }));

for (const source of ["authority", "parameters"] as const) {
	host.it(
		`SQL spans use the DATABASE_URL ${source} address without changing the connection`,
		[databaseAddress(source), nativeTracing],
		function* ({ ping, referenceConnection, databaseDestination, nativeSpans }) {
			const expected = yield* referenceConnection();
			const connection = JSON.parse(yield* ping());
			expect(connection.redacted).toBe(true);
			expect(connection.rows).toEqual(expected);
			const query = nativeSpans().find((span) => String(span.attributes.get("db.query.text")).includes("inet_server_addr"));
			expect(query).toBeDefined();
			expect(query?.attributes.get("server.address")).toBe("127.0.0.1");
			const url = databaseDestination();
			expect(query?.attributes.get("server.port")).toBe(Number(url.searchParams.get("port") ?? url.port));
			const attributes = JSON.stringify(nativeSpans().map((span) => Object.fromEntries(span.attributes)));
			expect(attributes).not.toContain(url.toString());
			expect(attributes).not.toContain(`${url.username}:${url.password}`);
		},
	);
}
