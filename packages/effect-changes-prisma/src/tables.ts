import { Effect, Schema } from "effect";
import { PrismaError } from "./error.ts";

const MODEL = /^[ \t]*model[ \t]+(?<model>\w+)[ \t]*\{(?<body>[\s\S]*?)^[ \t]*\}/gmu;
const MAPPED = /@@map\(\s*(?:name\s*:\s*)?"(?<table>[^"]+)"/u;
const COMMENT = /\/\/.*$/gmu;

export function tablesOf(schema: string): ReadonlyMap<string, string> {
	return new Map(
		[...schema.replace(COMMENT, "").matchAll(MODEL)].map(({ groups }) => {
			const model = groups?.model ?? "";
			const body = groups?.body ?? "";
			return [MAPPED.exec(body)?.groups?.table ?? model, model] as const;
		}),
	);
}

export interface RawQueryClient {
	$queryRawUnsafe: (query: string) => PromiseLike<unknown>;
}

export type TableWrites = ReadonlyMap<string, bigint>;

const Counted = Schema.Array(Schema.Struct({ relname: Schema.String, writes: Schema.BigInt }));

const COUNTED =
	"select relname, n_tup_ins + n_tup_upd + n_tup_del as writes from pg_stat_xact_user_tables where n_tup_ins + n_tup_upd + n_tup_del > 0 order by relname";

const none: TableWrites = new Map();

export const tableWrites = Effect.fn("PrismaChanges.tableWrites")(function* (client: RawQueryClient) {
	const rows = yield* Effect.tryPromise({ catch: (cause) => new PrismaError({ cause }), try: () => client.$queryRawUnsafe(COUNTED) });
	const decoded = yield* Effect.mapError(Schema.decodeUnknownEffect(Counted)(rows), (cause) => new PrismaError({ cause }));
	const counts = new Map<string, bigint>();
	for (const { relname, writes } of decoded) {
		counts.set(relname, (counts.get(relname) ?? 0n) + writes);
	}
	return counts satisfies TableWrites;
});

export const writtenTables = Effect.fn("PrismaChanges.writtenTables")(function* (client: RawQueryClient, since: TableWrites = none) {
	const counts = yield* tableWrites(client);
	return [...counts].flatMap(([table, writes]) => (writes > (since.get(table) ?? 0n) ? [table] : []));
});
