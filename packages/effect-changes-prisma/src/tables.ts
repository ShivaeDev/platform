import { Effect, Schema } from "effect";
import { PrismaError } from "./error.ts";

const MODEL = /^[ \t]*model[ \t]+(\w+)[ \t]*\{([\s\S]*?)^[ \t]*\}/gm;
const MAPPED = /@@map\(\s*(?:name\s*:\s*)?"([^"]+)"/;
const COMMENT = /\/\/.*$/gm;

export const tablesOf = (schema: string): ReadonlyMap<string, string> =>
	new Map([...schema.replace(COMMENT, "").matchAll(MODEL)].map(([, model = "", body = ""]) => [MAPPED.exec(body)?.[1] ?? model, model] as const));

export interface RawQueryClient {
	$queryRawUnsafe(query: string): PromiseLike<unknown>;
}

const Written = Schema.Array(Schema.Struct({ relname: Schema.String }));

const WRITTEN = "select relname from pg_stat_xact_user_tables where n_tup_ins + n_tup_upd + n_tup_del > 0 order by relname";

export const writtenTables = Effect.fn("PrismaChanges.writtenTables")(function* (client: RawQueryClient) {
	const rows = yield* Effect.tryPromise({ try: () => client.$queryRawUnsafe(WRITTEN), catch: (cause) => new PrismaError({ cause }) });
	const decoded = yield* Effect.mapError(Schema.decodeUnknownEffect(Written)(rows), (cause) => new PrismaError({ cause }));
	return decoded.map((row) => row.relname);
});
