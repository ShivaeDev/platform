import { Context } from "effect";
import type { PostgresChangeClient } from "./postgresChanges.ts";

export class PostgresChangeListener extends Context.Service<PostgresChangeListener, Pick<PostgresChangeClient, "listen">>()(
	"@shivaedev/sql/PostgresChangeListener",
) {}
