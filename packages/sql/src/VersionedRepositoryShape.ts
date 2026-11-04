import type { Model } from "effect/schema";
import type { PrimaryKey, Repository } from "#compositeRepository.ts";
import type { Queries } from "#repositoryQueries.ts";
import type { VersionColumn, VersionedWrites } from "#versionedRepository.ts";

export type VersionedRepositoryShape<TModel extends Model.Any, TId extends PrimaryKey<TModel>, TVersion extends VersionColumn<TModel, TId>> = Omit<
	Repository<TModel, TId>,
	keyof VersionedWrites<TModel, TId, TVersion>
> &
	VersionedWrites<TModel, TId, TVersion> &
	Queries<TModel>;
