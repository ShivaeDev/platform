import * as PgClient from "@effect/sql-pg/PgClient";
import * as PgConnection from "@effect/sql-pg/PgConnection";
import * as PgPool from "@effect/sql-pg/PgPool";
import { Effect, Predicate, Stream } from "effect";
import { SqlClient, type SqlConnection, Statement } from "effect/sql";
import { SqlError, UnknownError } from "effect/sql/SqlError";

const json = Statement.custom<PgClient.PgCustom>("PgJson");

export const makePostgresClient = Effect.fn("Sql.makePostgresClient")(function* (config: PgClient.PgClientConfig) {
	const pool = yield* PgPool.PgPool;
	const acquirer = Effect.flatMap(pool.get, (connection) => postgresConnection.pipe(Effect.provideService(PgConnection.PgConnection, connection)));
	const client = yield* SqlClient.make({
		acquirer,
		borrower: (use) =>
			pool.use((connection) => Effect.flatMap(postgresConnection.pipe(Effect.provideService(PgConnection.PgConnection, connection)), use)),
		commit: (connection) => Effect.flatMap(connection.executeRaw("COMMIT", []), commitResult),
		compiler: PgClient.makeCompiler(config.transformQueryNames),
		driver: "pg",
		prepareTransactionControls: true,
		releaseSavepoint: (name) => `RELEASE SAVEPOINT ${name}`,
		spanAttributes: [
			["db.system.name", "postgresql"],
			["db.namespace", config.database ?? config.username ?? "postgres"],
			["server.address", config.host ?? "localhost"],
			["server.port", config.port ?? 5432],
		],
		transactionAcquirer: Effect.flatMap(pool.reserve, (connection) =>
			postgresConnection.pipe(Effect.provideService(PgConnection.PgConnection, connection)),
		),
		transformRows: config.transformResultNames === undefined ? undefined : Statement.defaultTransforms(config.transformResultNames).array,
	});
	return Object.assign(client, {
		[PgClient.TypeId]: PgClient.TypeId,
		config,
		json: (value: unknown) => Statement.fragment([json(value)]),
		listen: (channel: string) =>
			Effect.gen(function* () {
				const connection = yield* pool.reserve;
				return yield* connection.listen(channel);
			}),
		notify: (channel: string, payload: string) =>
			pool.use((connection) => connection.query("SELECT pg_notify($1, $2)", [channel, payload])).pipe(Effect.asVoid),
		poolStats: pool.stats,
	}) satisfies PgClient.PgClient;
});

const postgresConnection = Effect.gen(function* () {
	const connection = yield* PgConnection.PgConnection;
	function execute(sql: string, params: readonly unknown[], transformRows: Parameters<SqlConnection.Connection["execute"]>[2], prepare = true) {
		const rows = Effect.map(connection.query(sql, params, prepare), (result) => result.rows);
		return transformRows === undefined ? rows : Effect.map(rows, transformRows);
	}
	return {
		execute,
		executeRaw: (sql, params) => connection.query(sql, params),
		executeStream: (sql, params, transformRows) => {
			const stream = connection.stream(sql, params);
			return transformRows === undefined ? stream : Stream.mapArray(stream, (rows) => [transformRows(rows)]).pipe(Stream.flattenIterable);
		},
		executeUnprepared: (sql, params, transformRows) => execute(sql, params, transformRows, false),
		executeValues: (sql, params) => connection.queryValues(sql, params),
		executeValuesUnprepared: (sql, params) => connection.queryValues(sql, params, false),
	} satisfies SqlConnection.Connection;
});

function commitResult(result: unknown) {
	return Predicate.hasProperty(result, "command") && result.command === "ROLLBACK"
		? Effect.fail(
				new SqlError({
					reason: new UnknownError({
						cause: new Error("COMMIT rolled back an aborted transaction"),
						message: "PgClient: COMMIT rolled back an aborted transaction",
						operation: "commit",
					}),
				}),
			)
		: Effect.void;
}
