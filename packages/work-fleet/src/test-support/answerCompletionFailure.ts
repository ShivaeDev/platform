import { Effect, Schedule } from "effect";
import { SqlClient } from "effect/sql";
import type { FleetHost } from "#host/config.ts";

export const answerCompletionFailure = Effect.fn("AnswerFixture.answerCompletionFailure")(function* (host: FleetHost) {
	const sql = yield* SqlClient.SqlClient;
	const sequence = `${host.namespace}_finish_attempts`;
	const check = `${host.namespace}_reject_finish`;
	const table = `${host.namespace}_answers`;
	yield* sql`create sequence ${sql(sequence)}`;
	yield* sql`create function ${sql(check)}() returns trigger language plpgsql as $$
		begin
			if TG_OP = 'DELETE' or NEW.error is not null then
				perform nextval('${sql.literal(sequence)}');
				raise exception 'Answer completion unavailable';
			end if;
			return NEW;
		end
	$$`;
	yield* sql`create trigger reject_finish before delete or update on ${sql(table)} for each row execute function ${sql(check)}()`;
	const attempted = sql<{ readonly attempts: string }>`select last_value::text as attempts from ${sql(sequence)} where is_called`.pipe(
		Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: (rows) => Number(rows[0]?.attempts ?? 0) >= 2 }),
		Effect.asVoid,
		Effect.timeout("5 seconds"),
	);
	return { attempted, release: sql`drop trigger reject_finish on ${sql(table)}` };
});
