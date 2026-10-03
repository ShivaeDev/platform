import type { Where } from "better-auth";
import type { AdapterFactoryCustomizeAdapterCreator, CustomAdapter } from "better-auth/adapters";
import { Effect, Option } from "effect";
import type { DynamicRelation, refineRelation } from "./relation.ts";

type CleanedWhere = Required<Where>;
type FindOneInput = Parameters<CustomAdapter["findOne"]>[0];
type FindManyInput = Parameters<CustomAdapter["findMany"]>[0];
type Row = Record<string, unknown>;
type RowMethod = "create" | "findMany" | "findOne" | "update";
type Refinement = Parameters<typeof refineRelation>[1];

interface RowMethods {
	readonly create: (input: { readonly data: Row; readonly model: string; readonly select?: string[] | undefined }) => Promise<Row>;
	readonly findMany: (input: FindManyInput) => Promise<ReadonlyArray<Row>>;
	readonly findOne: (input: FindOneInput) => Promise<Row | null>;
	readonly update: (input: { readonly model: string; readonly update: Row; readonly where: CleanedWhere[] }) => Promise<Row | null>;
}

export type RelationQuery = <Value>(
	model: string,
	refinement: Refinement,
	use: (relation: DynamicRelation<unknown>) => Effect.Effect<Value, unknown, unknown>,
) => Promise<Value>;

// Better Auth lets each call declare its row type; the rows are whatever its generated schema stored.
function rowTyped(adapter: Omit<CustomAdapter, RowMethod> & RowMethods): CustomAdapter;
function rowTyped(adapter: unknown): unknown {
	return adapter;
}

const rejectJoin = (join: unknown): void => {
	if (join !== undefined) {
		throw new TypeError("The Effect Prisma Better Auth adapter does not support experimental native joins");
	}
};

const namesId = (condition: CleanedWhere): boolean => condition.connector !== "OR" && condition.field === "id" && condition.operator === "eq";

export const makeRowAdapter =
	(query: RelationQuery, usePlural: boolean): AdapterFactoryCustomizeAdapterCreator =>
	({ debugLog, getFieldAttributes }) => {
		const isUnique = (model: string, condition: CleanedWhere): boolean =>
			condition.connector !== "OR"
			&& condition.operator === "eq"
			&& condition.mode !== "insensitive"
			&& (condition.field === "id" || getFieldAttributes({ field: condition.field, model }).unique === true);

		return rowTyped({
			count: ({ model, where }) => query(model, { where }, (relation) => relation.count()),
			create: ({ data, model, select }) => {
				debugLog("create", { model });
				return query(model, { select }, (relation) => relation.create(data));
			},
			delete: ({ model, where }) => {
				const byId = where.some(namesId);
				return query(model, { where }, (relation) => (byId ? Effect.asVoid(relation.delete()) : Effect.asVoid(relation.deleteAll())));
			},
			deleteMany: ({ model, where }) => query(model, { where }, (relation) => Effect.map(relation.deleteAll(), (rows) => rows.length)),
			findMany: ({ join, limit, model, offset, select, sortBy, where }) => {
				rejectJoin(join);
				return query(model, { limit, offset, select, sortBy, where }, (relation) => relation);
			},
			findOne: ({ join, model, select, where }) => {
				rejectJoin(join);
				return query(model, { select, where }, (relation) => Effect.map(relation.first(), Option.getOrNull));
			},
			options: { usePlural },
			update: ({ model, update, where }) => {
				if (where.length === 0) return Promise.resolve(null);
				const unique = where.some((condition) => isUnique(model, condition));
				return query(model, { where }, (relation) =>
					unique ? relation.update(update) : Effect.map(relation.updateAll(update), (rows) => rows[0] ?? null),
				);
			},
			updateMany: ({ model, update, where }) => query(model, { where }, (relation) => Effect.map(relation.updateAll(update), (rows) => rows.length)),
		});
	};
