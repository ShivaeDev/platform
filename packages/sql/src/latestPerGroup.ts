import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import type { Fragment } from "effect/sql/Statement";
import { pinnedGroups } from "#pinnedGroups.ts";
import type { LatestPerGroup } from "#repository.ts";
import { makeFilter } from "#repositoryFilter.ts";
import { tupleUnnest } from "#tupleUnnest.ts";

function groupMasks(input: readonly (readonly unknown[])[]) {
	const masks = new Map<string, (readonly unknown[])[]>();
	for (const group of input) {
		const mask = group.map((value) => (value === null ? "0" : "1")).join("");
		const groups = masks.get(mask) ?? [];
		groups.push(group);
		masks.set(mask, groups);
	}
	return [...masks.values()];
}

export function latestPerGroup(model: Model.Any, sql: SqlClient.SqlClient, tableName: string) {
	const { fieldAt, where } = makeFilter(model, sql);
	function groupSource(groups: readonly (readonly unknown[])[], partitionBy: readonly string[], fromTuple: boolean) {
		const partitions = sql.csv(partitionBy.map((key) => sql`${sql(key)}`));
		if (fromTuple) {
			const mask = partitionBy.map((key, index) => (groups[0]?.[index] === null ? sql`${sql(key)} is null` : sql`${sql(key)} is not null`));
			return sql`select ${partitions} from ${sql("__effect_sql_tuple_groups")} where ${sql.and(mask)}`;
		}
		const values = sql.join(" union ", false)(groups.map((group) => sql`select ${sql.csv(group.map((value) => sql`${value}`))}`));
		// The empty projection gives scalar pins their stored column types.
		return sql`select ${partitions} from ${sql(tableName)} where false union ${values}`;
	}

	return Effect.fnUntraced(function* (query: LatestPerGroup<Model.Any>, order: Fragment, rowLimit: number) {
		yield* Effect.forEach(query.partitionBy, fieldAt);
		const predicate = yield* where(query.where, true);
		const partitions = sql.csv(query.partitionBy.map((key) => sql`${sql(key)}`));
		const keys = Object.keys(model.fields);
		const columns = sql.csv(keys.map((key) => sql`${sql(key)}`));
		const pinned = yield* pinnedGroups(model, sql, query.partitionBy, query.where);
		if (pinned !== undefined && pinned.groups.length === 0) {
			return [];
		}
		if (pinned !== undefined && sql.onDialectOrElse({ orElse: () => false, pg: () => true })) {
			const remaining = yield* where(pinned.remaining, true);
			const tuple = pinned.tuple;
			const tupleRows = pinned.groups.map((group) => tuple?.fields.map((key) => group[query.partitionBy.indexOf(key)]) ?? group);
			const tupleSource =
				tuple === undefined
					? sql``
					: sql`with ${sql("__effect_sql_tuple_groups")} as materialized (
				select distinct * from ${yield* tupleUnnest(tuple.types, tupleRows).pipe(Effect.provideService(SqlClient.SqlClient, sql))}
				as ${sql("__effect_sql_tuples")} (${sql.csv(tuple.fields.map((key) => sql`${sql(key)}`))})
			), ${sql("__effect_sql_tuple_limit")} as (select ${rowLimit}::bigint as ${sql("limit")})`;
			const limit = tuple === undefined ? sql`${rowLimit}` : sql`(select ${sql("limit")} from ${sql("__effect_sql_tuple_limit")})`;

			const branches = groupMasks(pinned.groups).map((groups) => {
				const source = groupSource(groups, query.partitionBy, tuple !== undefined);
				const matches = query.partitionBy.map((key, index) =>
					groups[0]?.[index] === null ? sql`${sql(key)} is null` : sql`${sql(key)} = ${sql("__effect_sql_groups")}.${sql(key)}`,
				);
				// Null masks keep ordinary equality available to each non-null index column.
				return sql`select ${sql("__effect_sql_latest")}.* from (
					${source}
				) as ${sql("__effect_sql_groups")} cross join lateral (
					select ${columns} from ${sql(tableName)} where ${sql.and([...matches, remaining])} ${order} limit ${limit}
				) as ${sql("__effect_sql_latest")}`;
			});
			const ordering = sql.csv(query.orderBy.map(({ field, direction }) => sql`${sql(field)} ${sql.literal(direction === "desc" ? "desc" : "asc")}`));
			const rows =
				yield* sql`${tupleSource} select ${columns} from (${sql.join(" union all ")(branches)}) as ${sql("__effect_sql_pinned")} order by ${partitions}, ${ordering}`;
			return yield* Schema.decodeUnknownEffect(Schema.Array(Schema.Struct(model.fields)))(rows);
		}
		let rankColumn = "__effect_sql_rank";
		while (Object.hasOwn(model.fields, rankColumn)) {
			rankColumn += "_";
		}
		const rows = yield* sql`select ${columns} from (
			select ${columns}, row_number() over (partition by ${partitions} ${order}) as ${sql(rankColumn)}
			from ${sql(tableName)} where ${predicate}
		) as ${sql("__effect_sql_ranked")} where ${sql(rankColumn)} <= ${rowLimit}
		order by ${partitions}, ${sql(rankColumn)}`;
		return yield* Schema.decodeUnknownEffect(Schema.Array(Schema.Struct(model.fields)))(rows);
	});
}
