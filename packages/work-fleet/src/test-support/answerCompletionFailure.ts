import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { Fleet } from "#fleet.ts";
import type { FleetHost } from "#host/config.ts";
import { answerSignals } from "#test/answerSignals.ts";

export const answerCompletionFailure = Effect.fn("AnswerFixture.answerCompletionFailure")(function* (host: FleetHost, fleet: typeof Fleet.Service) {
	const signals = yield* answerSignals(fleet);
	const sql = yield* SqlClient.SqlClient;
	const check = `${host.namespace}_reject_finish`;
	const table = `${host.namespace}_answers`;
	yield* sql`create function ${sql(check)}() returns trigger language plpgsql as $$
		begin
			if TG_OP = 'DELETE' or NEW.error is not null then
				raise exception 'Answer completion unavailable';
			end if;
			return NEW;
		end
	$$`;
	yield* sql`create trigger reject_finish before delete or update on ${sql(table)} for each row execute function ${sql(check)}()`;
	const attempted = signals.wait((event) => event._tag === "CompletionFailed", 2).pipe(Effect.asVoid);
	return { attempted, release: sql`drop trigger reject_finish on ${sql(table)}` };
});
