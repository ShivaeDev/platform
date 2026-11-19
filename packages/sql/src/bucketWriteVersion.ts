import { Data, Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { BUCKET_WRITE_POSTGRES_VERSION, supportsBucketWrites } from "#supportsBucketWrites.ts";

export class BucketWriteVersionError extends Data.TaggedError("BucketWriteVersionError")<{
	readonly tableName: string;
	readonly found: string;
	readonly required: number;
}> {
	override get message() {
		return `Bucketed writes to ${this.tableName} require PostgreSQL ${this.required} or later because they read each row's previous bucket with RETURNING old; the database reports PostgreSQL ${this.found}`;
	}
}

const ServerVersion = Schema.Array(Schema.Struct({ number: Schema.NumberFromString, version: Schema.String }));

// Unqualified current_setting resolves through the session's search_path, which lets a story report another server version.
export const requireBucketWriteVersion = Effect.fnUntraced(function* (tableName: string) {
	const sql = yield* SqlClient.SqlClient;
	if (!sql.onDialectOrElse({ orElse: () => false, pg: () => true })) {
		return;
	}
	const [server] =
		yield* sql`select current_setting('server_version_num') as number, current_setting('server_version') as version`.withoutTransform.pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(ServerVersion)),
		);
	if (server === undefined || supportsBucketWrites(server.number)) {
		return;
	}
	return yield* new BucketWriteVersionError({ found: server.version, required: BUCKET_WRITE_POSTGRES_VERSION, tableName });
});
