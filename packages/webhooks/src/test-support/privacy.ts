import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { otlpReceiver } from "@shivaedev/test-story/server/otlpReceiver.ts";
import { auditQueue, issueQueue } from "#test/fixture.ts";
import type { InboxState } from "#test/host.ts";

const storedQueues = [auditQueue, issueQueue].map(({ name }) => defineQueue({ name, schema: Schema.Record(Schema.String, Schema.Unknown) }));

export const collectTelemetry = Effect.fnUntraced(function* (state: InboxState) {
	state.receiver = yield* otlpReceiver();
});

export function privacyVerbs(state: InboxState) {
	return {
		exportedTelemetry: () =>
			Effect.gen(function* () {
				const receiver = state.receiver;
				if (receiver === undefined) {
					return yield* Effect.die(new Error("No telemetry collector is running"));
				}
				let completed = 0;
				yield* receiver.untilSpan(
					(span) => {
						if (span.name !== "POST /hooks/:source") {
							return false;
						}
						completed += 1;
						return completed === state.answers.length;
					},
					{
						name: "the completed webhook requests",
						timeout: "5 seconds",
					},
				);
				return receiver.requests.map(({ body }) => body.toString()).join("\n");
			}),
		storedData: () =>
			Effect.gen(function* () {
				const testing = state.testing;
				if (testing === undefined) {
					return yield* Effect.die(new Error("The host has not started its jobs client"));
				}
				const jobs = yield* Effect.forEach(storedQueues, (queue) => testing.jobs(queue));
				const receipts = yield* SqlClient.SqlClient.use((sql) => sql`select * from webhook_receipts`.withoutTransform);
				return { jobs: jobs.flat().map(({ name, data }) => ({ data, name })), receipts };
			}),
	};
}
