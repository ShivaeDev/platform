import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient, SqlModel } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { OptimisticConcurrencyError } from "#repository.ts";
import type { RepositoryChanges } from "./repositoryChanges.ts";

export type IdColumn<TModel extends Model.Any> = keyof TModel["Type"] & keyof TModel["update"]["Type"] & keyof TModel["fields"];
export type VersionColumn<TModel extends Model.Any, TId extends IdColumn<TModel>> = {
	[TKey in Extract<keyof TModel["fields"] & keyof TModel["update"]["Type"], string>]: TModel["fields"][TKey] extends Schema.ConstraintCodec<
		number,
		number,
		never,
		never
	>
		? TModel["update"]["Type"] extends { readonly [TField in TKey]: number }
			? TKey
			: never
		: never;
}[Extract<keyof TModel["fields"] & keyof TModel["update"]["Type"], string>] &
	Exclude<keyof TModel["fields"], TId | keyof TModel["insert"]["Type"]>;

export type NativeRepository<TModel extends Model.Any, TId extends IdColumn<TModel>> = Effect.Success<
	ReturnType<typeof SqlModel.makeRepository<TModel, TId>>
>;
type WriteError = SqlError | Schema.SchemaError | OptimisticConcurrencyError;
export interface VersionedWrites<TModel extends Model.Any, TId extends IdColumn<TModel>> {
	readonly delete: (
		id: TModel["fields"][TId]["Type"],
		expectedVersion: number,
	) => Effect.Effect<void, WriteError, TModel["fields"][TId]["EncodingServices"]>;
	readonly insert: NativeRepository<TModel, TId>["insert"];
	readonly insertVoid: NativeRepository<TModel, TId>["insertVoid"];
	readonly update: (
		input: TModel["update"]["Type"],
	) => Effect.Effect<TModel["Type"], WriteError, TModel["update"]["EncodingServices"] | TModel["DecodingServices"]>;
	readonly updateVoid: (input: TModel["update"]["Type"]) => Effect.Effect<void, WriteError, TModel["update"]["EncodingServices"]>;
}

const Version = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

export function makeVersionedWrites<TModel extends Model.Any, TId extends IdColumn<TModel>>(
	model: TModel,
	sql: SqlClient.SqlClient,
	options: {
		readonly changes: RepositoryChanges;
		readonly tableName: string;
		readonly idColumn: TId;
		readonly spanPrefix: string;
		readonly versionColumn: string;
		readonly conflict: (id: unknown, expectedVersion: number) => OptimisticConcurrencyError;
	},
): VersionedWrites<TModel, TId> {
	const { conflict, tableName, spanPrefix, versionColumn } = options;
	const idColumn = String(options.idColumn);
	const encodeInsert = Schema.encodeEffect(model.insert);
	const encodeUpdate = Schema.encodeEffect(model.update);
	const decodeRow = Schema.decodeUnknownEffect(model);
	const idSchema = model.fields[options.idColumn];
	if (idSchema === undefined) {
		throw new Error(`Unknown ID column: ${idColumn}`);
	}
	const encodeId = Schema.encodeEffect(idSchema);
	const validateVersion = Schema.decodeUnknownEffect(Version);
	const record = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	function insertStatement(input: TModel["insert"]["Type"]) {
		return Effect.gen(function* () {
			const encoded = yield* record(yield* encodeInsert(input));
			return sql`insert into ${sql(tableName)} ${sql.insert({ ...encoded, [versionColumn]: 0 })}`;
		});
	}
	const insert: VersionedWrites<TModel, TId>["insert"] = (input) =>
		Effect.gen(function* () {
			const statement = yield* insertStatement(input);
			const rows = yield* sql`${statement} returning *`;
			yield* options.changes.record(rows);
			return yield* decodeRow(rows[0]);
		}).pipe(options.changes.write, Effect.withSpan(`${spanPrefix}.insert`));
	const insertVoid: VersionedWrites<TModel, TId>["insertVoid"] = (input) =>
		Effect.flatMap(insertStatement(input), (statement) =>
			sql`${statement} returning ${sql(idColumn)}`.pipe(Effect.flatMap(options.changes.record)),
		).pipe(options.changes.write, Effect.withSpan(`${spanPrefix}.insertVoid`));
	function updateStatement(input: TModel["update"]["Type"]) {
		return Effect.gen(function* () {
			const encoded = yield* record(yield* encodeUpdate(input));
			const expectedVersion = yield* validateVersion(encoded[versionColumn]);
			const assignments = Object.entries(encoded).filter(([key]) => key !== idColumn && key !== versionColumn);
			const set = sql.csv([
				...assignments.map(([key, value]) => sql`${sql(key)} = ${value}`),
				sql`${sql(versionColumn)} = ${sql(versionColumn)} + 1`,
			]);
			return {
				expectedVersion,
				statement: sql`update ${sql(tableName)} set ${set} where ${sql(idColumn)} = ${encoded[idColumn]} and ${sql(versionColumn)} = ${expectedVersion}`,
			};
		});
	}
	const update: VersionedWrites<TModel, TId>["update"] = (input) =>
		Effect.gen(function* () {
			const { expectedVersion, statement } = yield* updateStatement(input);
			const rows = yield* sql`${statement} returning *`;
			if (rows.length === 0) {
				return yield* Effect.fail(conflict(input[options.idColumn], expectedVersion));
			}
			yield* options.changes.record(rows);
			return yield* decodeRow(rows[0]);
		}).pipe(options.changes.write, Effect.withSpan(`${spanPrefix}.update`));
	const updateVoid: VersionedWrites<TModel, TId>["updateVoid"] = (input) =>
		Effect.gen(function* () {
			const { expectedVersion, statement } = yield* updateStatement(input);
			const rows = yield* sql`${statement} returning ${sql(idColumn)}`;
			if (rows.length === 0) {
				return yield* Effect.fail(conflict(input[options.idColumn], expectedVersion));
			}
			yield* options.changes.record(rows);
		}).pipe(options.changes.write, Effect.withSpan(`${spanPrefix}.updateVoid`));
	const delete_: VersionedWrites<TModel, TId>["delete"] = (id, expected) =>
		Effect.gen(function* () {
			const expectedVersion = yield* validateVersion(expected);
			const encodedId = yield* encodeId(id);
			const rows =
				yield* sql`delete from ${sql(tableName)} where ${sql(idColumn)} = ${encodedId} and ${sql(versionColumn)} = ${expectedVersion} returning ${sql(idColumn)}`;
			if (rows.length === 0) {
				return yield* Effect.fail(conflict(id, expectedVersion));
			}
			yield* options.changes.record(rows);
		}).pipe(options.changes.write, Effect.withSpan(`${spanPrefix}.delete`));
	return { delete: delete_, insert, insertVoid, update, updateVoid };
}
