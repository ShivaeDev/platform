import { DateTime, Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { configured, postgres } from "#test-support/postgres.ts";
import { startHost } from "./host.ts";
import { mintUser } from "./sessionPrecondition.ts";

export const browserReports = storyKit({
	clock: Effect.runSync(DateTime.now),
	around: withIsolatedDatabase,
	*create() {
		const host = yield* startHost();
		const { headers, user } = yield* mintUser(host, "alice");
		return { headers, host, user };
	},
	layer: postgres,
	name: "browser reports",
	runIf: configured,
	stages: [],
	verbs: ({ host, headers, user }, story) => ({
		recordedReports: () =>
			Effect.sync(() =>
				host.logs
					.filter((entry) => entry.annotations["browser.kind"] !== undefined)
					.map((entry) => ({
						level: entry.level,
						user: entry.annotations["user.id"] === user.id ? "alice" : entry.annotations["user.id"],
					})),
			),
		report: (signedIn: boolean) => {
			story.tell(`${signedIn ? "alice" : "a signed-out visitor"} reports a browser error`);
			return Effect.promise(async () => {
				const response = await fetch(`${host.baseUrl}/_platform/errors`, {
					body: JSON.stringify({ kind: "error", message: 'TypeError: "private words" is not a function', url: host.baseUrl }),
					headers: { "content-type": "application/json", origin: host.origin, ...(signedIn ? { cookie: headers.get("cookie") ?? "" } : {}) },
					method: "POST",
				});
				return response.status;
			});
		},
	}),
});
