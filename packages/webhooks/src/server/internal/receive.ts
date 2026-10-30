import { Effect, Option, type Redacted } from "effect";
import { HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { SqlClient } from "effect/sql";
import type { PgBossService } from "@shivaedev/jobs/server/service.ts";
import { enqueueWebhookJobs, type WebhookSource } from "#server/registration.ts";

export const receive = Effect.fn("Webhooks.receive")(function* <R, E>(
	name: string,
	source: WebhookSource<R, E>,
	key: Redacted.Redacted<string>,
	body: Uint8Array,
	headers: Readonly<Record<string, string>>,
	jobs: PgBossService,
) {
	yield* source.strategy.verify(body, headers, key);
	const { id, event } = source.strategy.delivery(headers);
	if (!(id && event)) {
		return HttpServerResponse.text("Invalid delivery", { status: HttpStatus.fromLiteral("BadRequest") });
	}
	const definition = Object.hasOwn(source.events, event) ? source.events[event] : undefined;
	const sql = yield* SqlClient.SqlClient;
	return yield* sql.withTransaction(
		Effect.gen(function* () {
			const inserted = yield* sql`insert into webhook_receipts (source, delivery_id, event, outcome, job_ids)
				values (${name}, ${id}, ${event}, 'ignored', array[]::text[])
				on conflict (source, delivery_id) do nothing returning delivery_id`;
			if (inserted.length === 0) {
				return HttpServerResponse.text("already queued", { status: HttpStatus.fromLiteral("OK") });
			}
			const requests = definition === undefined ? [] : yield* definition.decode(body);
			const ids = (yield* enqueueWebhookJobs(requests, jobs)).flatMap(Option.toArray);
			yield* sql`update webhook_receipts set job_ids = array[${sql.csv(ids.map((jobId) => sql`${jobId}`))}]::text[], outcome = ${requests.length === 0 ? "ignored" : "queued"} where source = ${name} and delivery_id = ${id}`;
			return HttpServerResponse.text(requests.length === 0 ? "ignored" : "queued", {
				status: requests.length === 0 ? HttpStatus.fromLiteral("OK") : HttpStatus.fromLiteral("Accepted"),
			});
		}),
	);
});
