import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import type { Fragment } from "effect/sql/Statement";
import { pinnedGroups } from "#pinnedGroups.ts";
import type { LatestPerGroup } from "#repository.ts";
import { makeFilter } from "#repositoryFilter.ts";

export function latestPerGroup(model: Model.Any, sql: SqlClient.SqlClient, tableName: string) {
	const { fieldAt, where } = makeFilter(model, sql);
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
			const masks = new Map<string, (readonly unknown[])[]>();
			for (const group of pinned.groups) {
				const mask = group.map((value) => (value === null ? "0" : "1")).join("");
				const groups = masks.get(mask) ?? [];
				groups.push(group);
				masks.set(mask, groups);
			}
			const branches = Array.from(masks.values(), (groups) => {
				const values = sql.join(" union ", false)(groups.map((group) => sql`select ${sql.csv(group.map((value) => sql`${value}`))}`));
				const matches = query.partitionBy.map((key, index) =>
					groups[0]?.[index] === null ? sql`${sql(key)} is null` : sql`${sql(key)} = ${sql("__effect_sql_groups")}.${sql(key)}`,
				);
				// The empty table projection gives encoded parameters their actual PostgreSQL column types.
				return sql`select ${sql("__effect_sql_latest")}.* from (
					select ${partitions} from ${sql(tableName)} where false union ${values}
				) as ${sql("__effect_sql_groups")} cross join lateral (
					select ${columns} from ${sql(tableName)} where ${sql.and([...matches, remaining])} ${order} limit ${rowLimit}
				) as ${sql("__effect_sql_latest")}`;
			});
			const ordering = sql.csv(query.orderBy.map(({ field, direction }) => sql`${sql(field)} ${sql.literal(direction === "desc" ? "desc" : "asc")}`));
			const rows =
				yield* sql`select ${columns} from (${sql.join(" union all ")(branches)}) as ${sql("__effect_sql_pinned")} order by ${partitions}, ${ordering}`;
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
