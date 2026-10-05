import { PrismaPg } from "@prisma/adapter-pg";
import { Effect, type Scope } from "effect";
import { test } from "vitest";
import { PrismaClient } from "#test/generated/client.ts";
import { databaseUrl } from "./environment.ts";

export const integration = databaseUrl === undefined ? test.skip : test;

const url = databaseUrl ?? "postgresql://integration-tests-disabled";

const tables = (schema: string) => [
	`create schema "${schema}"`,
	`create table "${schema}".changes_prisma_order (id text primary key, owner_id text not null, total integer not null)`,
	`create table "${schema}".changes_prisma_membership (id text primary key, owner_id text not null, member_id text not null)`,
	`create table "${schema}".changes_prisma_invoice (id text primary key, owner_id text not null,
		order_id text references "${schema}".changes_prisma_order (id) deferrable initially deferred)`,
	`create table "${schema}"."AuditNote" (id text primary key, text text not null)`,
	`create table "${schema}".changes_prisma_unmodeled (id text primary key)`,
];

export interface ConnectOptions {
	readonly max?: number;
	readonly timeout?: number;
}

export const connect = (schema: string, options: ConnectOptions = {}) =>
	Effect.acquireRelease(
		Effect.sync(
			() =>
				new PrismaClient({
					adapter: new PrismaPg({ connectionString: url, ...(options.max === undefined ? {} : { max: options.max }) }, { schema }),
					...(options.timeout === undefined ? {} : { transactionOptions: { timeout: options.timeout } }),
				}),
		),
		(client) => Effect.promise(() => client.$disconnect()),
	);

const statements = (client: PrismaClient, sql: readonly string[]) =>
	Effect.promise(async () => {
		for (const statement of sql) {
			await client.$executeRawUnsafe(statement);
		}
	});

export const makeDatabase: Effect.Effect<
	{
		readonly schema: string;
		readonly client: PrismaClient;
		readonly observer: PrismaClient;
		readonly execute: (...sql: readonly string[]) => Effect.Effect<void>;
	},
	never,
	Scope.Scope
> = Effect.gen(function* () {
	const schema = `changes_prisma_${crypto.randomUUID().replaceAll("-", "")}`;
	const admin = yield* connect("public");
	yield* Effect.acquireRelease(statements(admin, tables(schema)), () => statements(admin, [`drop schema "${schema}" cascade`]));
	const client = yield* connect(schema);
	const observer = yield* connect(schema);
	return { client, execute: (...sql: readonly string[]) => statements(admin, sql), observer, schema };
});

export const orderIds = (client: PrismaClient) =>
	Effect.map(
		Effect.promise(() => client.order.findMany({ orderBy: { id: "asc" }, select: { id: true } })),
		(rows) => rows.map((row) => row.id),
	);
