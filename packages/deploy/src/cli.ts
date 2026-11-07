import { Effect } from "effect";
import { isPostgresSchedulesCli, postgresSchedulesCommand } from "#adapters/railway/postgresSchedulesCommand.ts";

if (isPostgresSchedulesCli(import.meta.url)) {
	void Effect.runPromise(postgresSchedulesCommand());
}
