import { Data, Effect, type Schema } from "effect";
import type { Model } from "effect/schema";
import { SqlClient, SqlModel } from "effect/sql";
import { makeCompositeCrud, type PrimaryKey, type Repository } from "#compositeRepository.ts";
import { type ConflictColumns, type ConflictWrites, makeConflictWrites } from "#conflictWrites.ts";
import { makeQueries, type Queries } from "#repositoryQueries.ts";
import { type IdColumn, makeVersionedWrites, type NativeRepository, type VersionColumn, type VersionedWrites } from "#versionedRepository.ts";

type Key<TModel extends Model.Any> = Extract<keyof TModel["fields"] & keyof Row<TModel>, string>;
type Row<TModel extends Model.Any> = Schema.Struct.Type<TModel["fields"]>;

export interface FindMany<TModel extends Model.Any, TKey extends Key<TModel>> {
	readonly limit?: number;
	readonly orderBy?: {
		readonly field: Key<TModel>;
		readonly direction: "asc" | "desc";
	};
	readonly select?: readonly [TKey, ...TKey[]];
	readonly where?: { readonly [TField in keyof Row<TModel>]?: Row<TModel>[TField] | undefined };
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
	options: RepositoryOptions<TId> & { readonly versionColumn: VersionColumn<TModel, TId>; readonly conflictColumns?: never },
): Effect.Effect<
	Omit<NativeRepository<TModel, TId>, keyof VersionedWrites<TModel, TId>> & VersionedWrites<TModel, TId> & Queries<TModel>,
	never,
	SqlClient.SqlClient
>;
export function makeRepository<TModel extends Model.Any, const TId extends PrimaryKey<TModel>, const TConflict extends ConflictColumns<TModel>>(
	model: TModel,
	options: RepositoryOptions<TId> & { readonly versionColumn?: never; readonly conflictColumns: TConflict },
): Effect.Effect<
	Repository<TModel, TId> & Queries<TModel> & ConflictWrites<TModel, TConflict[number] | (TId extends readonly PropertyKey[] ? TId[number] : TId)>,
	never,
	SqlClient.SqlClient
>;
export function makeRepository<TModel extends Model.Any, const TId extends PrimaryKey<TModel>>(
	model: TModel,
	options: RepositoryOptions<TId> & { readonly versionColumn?: never; readonly conflictColumns?: never },
): Effect.Effect<Repository<TModel, TId> & Queries<TModel>, never, SqlClient.SqlClient>;
export function makeRepository<TModel extends Model.Any, TId extends IdColumn<TModel>>(
	model: TModel,
	options: RepositoryOptions<TId | readonly [TId, TId, ...TId[]]> & {
		readonly versionColumn?: string;
		readonly conflictColumns?: readonly string[];
	},
): Effect.Effect<unknown, never, SqlClient.SqlClient> {
	return Effect.fnUntraced(function* () {
		const sql = yield* SqlClient.SqlClient;
		const composite = typeof options.idColumn === "object";
		const idColumn = composite ? options.idColumn[0] : options.idColumn;
		const idColumns = (composite ? options.idColumn : [options.idColumn]).map(String);
		const crud = yield* SqlModel.makeRepository(model, { ...options, idColumn });
		const keyed = composite ? makeCompositeCrud(model, sql, { ...options, columns: idColumns }) : {};
		const { findMany } = makeQueries(model, sql, options);
		return options.versionColumn === undefined
			? {
					...crud,
					...keyed,
					...(options.conflictColumns === undefined
						? {}
						: makeConflictWrites(model, sql, { ...options, conflictColumns: options.conflictColumns, idColumns })),
					findMany,
				}
			: {
					...crud,
					...makeVersionedWrites(model, sql, {
						...options,
						conflict: (id, expectedVersion) => new OptimisticConcurrencyError({ expectedVersion, id, tableName: options.tableName }),
						idColumn,
						versionColumn: options.versionColumn,
					}),
					findMany,
				};
	})();
}
