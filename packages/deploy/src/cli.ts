import { Effect } from "effect";
import { postgresSchedulesCommand } from "#adapters/railway/postgresSchedulesCommand.ts";

void Effect.runPromise(postgresSchedulesCommand());
