import { Context } from "effect";
import type { Connection } from "effect/sql/SqlConnection";
export class SchemaConnection extends Context.Service<SchemaConnection, Connection>()("@shivaedev/jobs/SchemaConnection") {}
