import * as PgTypes from "@effect/sql-pg/PgTypes";
import type { Schema } from "effect";
import { jsonStorage } from "#jsonStorage.ts";

export function jsonb<TSchema extends Schema.Top>(schema: TSchema) {
	return jsonStorage(schema, PgTypes.jsonb);
}
