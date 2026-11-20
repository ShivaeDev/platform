import { Data, Effect, type Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import { makeBatchedDelete } from "#batchedDelete.ts";
import { type BatchWrites, makeInsertMany } from "#batchWrites.ts";
import { makeCompositeCrud, type PrimaryKey, type Repository } from "#compositeRepository.ts";
import { type ConflictColumns, type ConflictWrites, makeConflictWrites } from "#conflictWrites.ts";
import { makeInsertFromSelect, type SelectWrites } from "#insertFromSelect.ts";
import { makeRecordRead } from "#recordRepositoryRead.ts";
import { repositoryChanges } from "#repositoryChanges.ts";
import { type RepositoryBuildError, type RepositoryOptions, resolveRepositoryOptions, validateRepositoryCollection } from "#repositoryCollection.ts";
import type { FindManyFilter, RepositoryFilter } from "#repositoryFilter.ts";
import { makeQueries, type Queries } from "#repositoryQueries.ts";
import { refuseServerOnlyKeys } from "#serverOnly.ts";
import type { VersionedRepositoryShape } from "#VersionedRepositoryShape.ts";
import { type IdColumn, makeVersionedWrites, type VersionColumn } from "#versionedRepository.ts";

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

export type FindOne<TModel extends Model.Any, TKey extends Key<TModel>> = Omit<FindMany<TModel, TKey>, "limit">;

export interface LatestPerGroup<TModel extends Model.Any> {
	readonly limit: number;
	readonly orderBy: readonly [OrderBy<TModel>, ...OrderBy<TModel>[]];
	readonly partitionBy: readonly [Key<TModel>, ...Key<TModel>[]];
	readonly where?: FindManyFilter<TModel>;
}

export class OptimisticConcurrencyError extends Data.TaggedError("OptimisticConcurrencyError")<{
	readonly tableName: string;
	readonly id: unknown;
	readonly expectedVersion: number;
	readonly reason: "missing" | "stale";
}> {}

export function makeRepository<
	TModel extends Model.Any,
	const TConflict extends ConflictColumns<TModel>,
	const TId extends PrimaryKey<TModel> = Extract<PrimaryKey<TModel>, "id">,
	const TWhere extends keyof RepositoryFilter<TModel> = never,
	const TVersion extends VersionColumn<TModel, TId> = VersionColumn<TModel, TId>,
>(
	model: TModel,
	options: RepositoryOptions<TModel, TId> & {
		readonly versionColumn: TVersion;
		readonly conflictColumns: TConflict;
		readonly conflictWhere?: Pick<RepositoryFilter<TModel>, TWhere>;
	},
): Effect.Effect<
	VersionedRepositoryShape<TModel, TId, TVersion> &
		Pick<ConflictWrites<TModel, never, TModel["fields"][Extract<TWhere, keyof TModel["fields"]>]["EncodingServices"]>, "insertOrIgnore">,
	RepositoryBuildError,
	SqlClient.SqlClient
>;
export function makeRepository<
	TModel extends Model.Any,
	const TId extends PrimaryKey<TModel> = Extract<PrimaryKey<TModel>, "id">,
	const TVersion extends VersionColumn<TModel, TId> = VersionColumn<TModel, TId>,
>(
	model: TModel,
	options: RepositoryOptions<TModel, TId> & {
		readonly versionColumn: TVersion;
		readonly conflictColumns?: never;
		readonly conflictWhere?: never;
	},
): Effect.Effect<VersionedRepositoryShape<TModel, TId, TVersion>, RepositoryBuildError, SqlClient.SqlClient>;
export function makeRepository<
	TModel extends Model.Any,
	const TConflict extends ConflictColumns<TModel>,
	const TId extends PrimaryKey<TModel> = Extract<PrimaryKey<TModel>, "id">,
	const TWhere extends keyof RepositoryFilter<TModel> = never,
>(
	model: TModel,
	options: RepositoryOptions<TModel, TId> & {
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
	RepositoryBuildError,
	SqlClient.SqlClient
>;
export function makeRepository<TModel extends Model.Any, const TId extends PrimaryKey<TModel> = Extract<PrimaryKey<TModel>, "id">>(
	model: TModel,
	options: RepositoryOptions<TModel, TId> & { readonly versionColumn?: never; readonly conflictColumns?: never; readonly conflictWhere?: never },
): Effect.Effect<Repository<TModel, TId> & BatchWrites<TModel> & SelectWrites<TModel> & Queries<TModel>, RepositoryBuildError, SqlClient.SqlClient>;
export function makeRepository<TModel extends Model.Any, TId extends IdColumn<TModel>>(
	model: TModel,
	options: RepositoryOptions<TModel, TId | readonly [TId, TId, ...TId[]]> & {
		readonly versionColumn?: string;
		readonly conflictColumns?: readonly string[];
		readonly conflictWhere?: Readonly<Record<string, unknown>>;
	},
): Effect.Effect<unknown, RepositoryBuildError, SqlClient.SqlClient> {
	return Effect.fnUntraced(function* () {
		const resolved = resolveRepositoryOptions(options);
		const { idColumn, tableName } = resolved;
		const idColumns = (typeof idColumn === "object" ? idColumn : [idColumn]).map(String);
		yield* refuseServerOnlyKeys(tableName, idColumns, model.fields, options.collection?.tuples);
		yield* validateRepositoryCollection(model.fields, resolved);
		const changes = yield* repositoryChanges(tableName, idColumns, model.fields, options.collection?.tuples);
		const recordRead = makeRecordRead(model, { idColumns, tableName, tuples: options.collection?.tuples });
		const crud = {
			...(yield* makeCompositeCrud(model, { ...resolved, columns: idColumns, recordRead }, changes)),
			deleteBatched: yield* makeBatchedDelete(model, resolved, changes),
		};
		const queries = yield* makeQueries(model, { ...resolved, recordRead });
		return {
			...crud,
			...queries,
			...(options.versionColumn === undefined
				? {
						insertFromSelect: yield* makeInsertFromSelect(model, { ...resolved, changes }, "insertFromSelect"),
						insertMany: yield* makeInsertMany(model, { ...resolved, changes }, "insertMany"),
						...(options.conflictColumns === undefined
							? {}
							: yield* makeConflictWrites(model, { ...resolved, changes, conflictColumns: options.conflictColumns, idColumns })),
					}
				: yield* makeVersionedWrites(model, {
						...resolved,
						changes,
						conflict: (id, expectedVersion, reason) => new OptimisticConcurrencyError({ expectedVersion, id, reason, tableName }),
						idColumns,
						versionColumn: options.versionColumn,
					})),
		};
	})();
}
