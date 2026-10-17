import { type Duration, Effect } from "effect";
import type { ModelRow, TransactionOptions } from "#model.ts";
import type { PrismaClient } from "#test/generated/client.ts";
import { makeChanges, models } from "./changes.ts";
import { coverageSettings, schemaText } from "./coverageHarness.ts";
import { type ConnectOptions, connect, orderIds } from "./database.ts";
import { probe, warm } from "./expiry.ts";
import { nonnegativeOrderChanges } from "./nonnegativeOrderChanges.ts";
import { prisma } from "./prisma.ts";

export function clientIsConfigured(options: ConnectOptions) {
	return prisma.trait("connection", `the Prisma client is configured with ${JSON.stringify(options)}`, function* (engine) {
		engine.client = yield* connect(engine.schema, options);
		yield* warm(engine.client);
		engine.binding = makeChanges(engine.client, () =>
			orderIds(engine.observer).pipe(
				Effect.flatMap((ids) =>
					Effect.sync(() => {
						engine.seen.push(ids);
					}),
				),
			),
		);
	});
}

export function transactionHasOptions(options: TransactionOptions) {
	return prisma.trait("behavior", `transactions use ${JSON.stringify(options)}`, (engine) => {
		engine.options = options;
	});
}

export function bodyWaits(duration: Duration.Input) {
	return prisma.trait("behavior", `the body waits ${duration}`, (engine) => {
		engine.probe = probe(duration);
	});
}

export function ordersExist(...orders: readonly ModelRow<PrismaClient, "Order">[]) {
	return prisma.trait("data", `${orders.length} orders already exist`, (engine) =>
		Effect.promise(async () => {
			await engine.client.order.createMany({ data: [...orders] });
		}),
	);
}

export function membershipsExist(...memberships: readonly ModelRow<PrismaClient, "Membership">[]) {
	return prisma.trait("data", `${memberships.length} memberships already exist`, (engine) =>
		Effect.promise(async () => {
			await engine.client.membership.createMany({ data: [...memberships] });
		}),
	);
}

export function coverageIsChecked() {
	return prisma.trait("behavior", "coverage checks compare recorded domains with the Prisma schema", function* (engine) {
		engine.coverage = coverageSettings(yield* schemaText);
	});
}

export function schemaIs(schema: string) {
	return prisma.trait("behavior", "coverage uses the supplied model declarations", (engine) => {
		engine.coverage = coverageSettings(schema);
	});
}

export function lookupTableExists() {
	return prisma.trait("data", "a lookup table can be read without writing it", (engine) =>
		engine.execute(`create table "${engine.schema}".changes_prisma_lookup (id text primary key)`),
	);
}

export function insertsTakeTheirTime() {
	return prisma.trait("behavior", "order inserts wait inside PostgreSQL", (engine) =>
		engine.execute(
			`create function "${engine.schema}".slow_insert() returns trigger language plpgsql as $$ begin perform pg_sleep(0.3); return new; end $$`,
			`create trigger slow_insert before insert on "${engine.schema}".changes_prisma_order for each row execute function "${engine.schema}".slow_insert()`,
		),
	);
}

export function commitTakesItsTime() {
	return prisma.trait("behavior", "COMMIT waits inside PostgreSQL", (engine) =>
		engine.execute(
			`create function "${engine.schema}".slow_commit() returns trigger language plpgsql as $$ begin perform pg_sleep(1); return null; end $$`,
			`create constraint trigger slow_commit after insert on "${engine.schema}".changes_prisma_order deferrable initially deferred for each row execute function "${engine.schema}".slow_commit()`,
		),
	);
}

export function mappingRejectsNegativeTotals(error: Error) {
	return prisma.trait("connection", "negative totals cannot name a change", (engine) => {
		engine.binding = makeChanges(engine.client, undefined, {
			...models,
			Order: nonnegativeOrderChanges(error),
		});
	});
}

export function invoicesAreUnmapped() {
	return prisma.trait("connection", "invoice writes have no mapping", (engine) => {
		const { Invoice: _invoice, ...partial } = models;
		engine.binding = makeChanges(engine.client, undefined, partial);
	});
}
