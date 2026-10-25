import { Data, Effect, type Schema } from "effect";
import type { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { type BatchWrites, makeInsertMany } from "#batchWrites.ts";
import { makeCompositeCrud, type PrimaryKey, type Repository } from "#compositeRepository.ts";
import { type ConflictColumns, type ConflictWrites, makeConflictWrites } from "#conflictWrites.ts";
import { makeInsertFromSelect, type SelectWrites } from "#insertFromSelect.ts";
import { repositoryChanges } from "#repositoryChanges.ts";
import type { FindManyFilter, RepositoryFilter, RepositoryListFilter } from "#repositoryFilter.ts";
import { makeQueries, type Queries } from "#repositoryQueries.ts";
import { type IdColumn, makeVersionedWrites, type NativeRepository, type VersionColumn, type VersionedWrites } from "#versionedRepository.ts";

type Key<TModel extends Model.Any> = Extract<keyof TModel["fields"] & keyof Row<TModel>, string>;
type Row<TModel extends Model.Any> = Schema.Struct.Type<TModel["fields"]>;

export interface OrderBy<TModel extends Model.Any> {
	readonly direction: "asc" | "desc";
	readonly field: Key<TModel>;
}

export interface FindMany<TModel extends Model.Any, TKey extends Key<TModel>> {
	readonly limit?: number;
	readonly orderBy?: OrderBy<TModel> | readonly [OrderBy<TModel>, ...OrderBy<TModel>[]];
	readonly select?: readonly [TKey, ...TKey[]];
	readonly where?: FindManyFilter<TModel>;
}

export interface LatestPerGroup<TModel extends Model.Any> {
	readonly limit: number;
	readonly orderBy: readonly [OrderBy<TModel>, ...OrderBy<TModel>[]];
	readonly partitionBy: readonly [Key<TModel>, ...Key<TModel>[]];
	readonly where?: RepositoryListFilter<TModel>;
}

export class OptimisticConcurrencyError extends Data.TaggedError("OptimisticConcurrencyError")<{
	readonly tableName: string;
	readonly id: unknown;
	readonly expectedVersion: number;
}> {}

interface RepositoryOptions<TId> {
	readonly idColumn: TId;
	readonly spanPrefix: string;
	readonly tableName: string;
}

export function makeRepository<TModel extends Model.Any, TId extends IdColumn<TModel>>(
	model: TModel,
	options: RepositoryOptions<TId> & {
		readonly versionColumn: VersionColumn<TModel, TId>;
		readonly conflictColumns?: never;
		readonly conflictWhere?: never;
	},
): Effect.Effect<
	Omit<NativeRepository<TModel, TId>, keyof VersionedWrites<TModel, TId>> & VersionedWrites<TModel, TId> & Queries<TModel>,
	never,
	SqlClient.SqlClient
>;
export function makeRepository<
	TModel extends Model.Any,
	const TId extends PrimaryKey<TModel>,
	const TConflict extends ConflictColumns<TModel>,
	const TWhere extends keyof RepositoryFilter<TModel> = never,
>(
	model: TModel,
	options: RepositoryOptions<TId> & {
		readonly versionColumn?: never;
		readonly conflictColumns: TConflict;
		readonly conflictWhere?: Pick<RepositoryFilter<TModel>, TWhere>;
	},
): Effect.Effect<
	Repository<TModel, TId> &
		BatchWrites<TModel> &
		SelectWrites<TModel> &
		Queries<TModel> &
		ConflictWrites<
			TModel,
			TConflict[number] | (TId extends readonly PropertyKey[] ? TId[number] : TId),
			TModel["fields"][Extract<TWhere, keyof TModel["fields"]>]["EncodingServices"]
		>,
	never,
	SqlClient.SqlClient
>;
export function makeRepository<TModel extends Model.Any, const TId extends PrimaryKey<TModel>>(
	model: TModel,
	options: RepositoryOptions<TId> & { readonly versionColumn?: never; readonly conflictColumns?: never; readonly conflictWhere?: never },
): Effect.Effect<Repository<TModel, TId> & BatchWrites<TModel> & SelectWrites<TModel> & Queries<TModel>, never, SqlClient.SqlClient>;
export function makeRepository<TModel extends Model.Any, TId extends IdColumn<TModel>>(
	model: TModel,
	options: RepositoryOptions<TId | readonly [TId, TId, ...TId[]]> & {
		readonly versionColumn?: string;
		readonly conflictColumns?: readonly string[];
		readonly conflictWhere?: Readonly<Record<string, unknown>>;
	},
): Effect.Effect<unknown, never, SqlClient.SqlClient> {
	return Effect.fnUntraced(function* () {
		const sql = yield* SqlClient.SqlClient;
		const composite = typeof options.idColumn === "object";
		const idColumn = composite ? options.idColumn[0] : options.idColumn;
		const idColumns = (composite ? options.idColumn : [options.idColumn]).map(String);
		const changes = yield* repositoryChanges(sql, options.tableName, idColumns);
		const crud = makeCompositeCrud(model, sql, { ...options, columns: idColumns }, changes);
		const queries = makeQueries(model, sql, options);
		return options.versionColumn === undefined
			? {
					...crud,
					insertFromSelect: makeInsertFromSelect(model, sql, { ...options, changes }, "insertFromSelect"),
					insertMany: makeInsertMany(model, sql, { ...options, changes }, "insertMany"),
					...(options.conflictColumns === undefined
						? {}
						: makeConflictWrites(model, sql, { ...options, changes, conflictColumns: options.conflictColumns, idColumns })),
					...queries,
				}
			: {
					...crud,
					...makeVersionedWrites(model, sql, {
						...options,
						changes,
						conflict: (id, expectedVersion) => new OptimisticConcurrencyError({ expectedVersion, id, tableName: options.tableName }),
						idColumn,
						versionColumn: options.versionColumn,
					}),
					...queries,
				};
	})();
}
