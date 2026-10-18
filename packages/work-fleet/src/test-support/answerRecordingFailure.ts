import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { FleetHost } from "#host/config.ts";

export const answerRecordingFailure = Effect.fn("AnswerFixture.answerRecordingFailure")(function* (host: FleetHost, fail: boolean) {
	const sql = yield* SqlClient.SqlClient;
	yield* fail
		? sql`alter table ${sql(`${host.namespace}_answers`)} add constraint recording_unavailable check (false)`
		: sql`alter table ${sql(`${host.namespace}_answers`)} drop constraint recording_unavailable`;
});

export const answerQueueFailure = Effect.fn("AnswerFixture.answerQueueFailure")(function* (host: FleetHost) {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`alter table ${sql(`${host.namespace}_records`)} add constraint guidance_unavailable check (${sql("pendingAnswers")} is null)`;
});
