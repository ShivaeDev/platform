import { Option } from "effect";
import { bindingIsolation } from "./bindingIsolation.ts";
import { makeChanges } from "./changes.ts";
import { connect } from "./database.ts";
import { postgresEngine } from "./postgresEngine.ts";
import { prisma } from "./prisma.ts";

export function postgres() {
	return prisma.trait("database", "Prisma connects to a fresh PostgreSQL schema", function* (engine) {
		engine.database = Option.some(yield* postgresEngine(engine.options));
	});
}

export function clientHasTimeout(timeout: number) {
	return prisma.trait("configuration", `the client has a ${timeout}ms timeout`, (engine) => {
		engine.options = { ...engine.options, timeout };
	});
}

export function currentClientHasTimeout(currentTimeout: number) {
	return prisma.trait("configuration", `another current client has a ${currentTimeout}ms timeout`, (engine) => {
		engine.options = { ...engine.options, currentTimeout };
	});
}

export function singleConnection() {
	return prisma.trait("configuration", "the client shares one connection", (engine) => {
		engine.options = { ...engine.options, max: 1 };
	});
}

export function sinkReadsCommittedRows() {
	return prisma.trait("configuration", "the publication sink reads committed orders", (engine) => {
		engine.options = { ...engine.options, observeCommitted: true };
	});
}

export function rejectsNegativeTotals(mappingError: Error) {
	return prisma.trait("configuration", "the mapping rejects negative order totals", (engine) => {
		engine.options = { ...engine.options, mappingError };
	});
}

export function twoPackageCopies() {
	return prisma.trait("fixtures", "two package copies bind clients under the same name", function* (engine) {
		engine.bindings = Option.some(yield* bindingIsolation());
	});
}

export function anotherBinding() {
	return prisma.trait("fixtures", "another binding uses its own client", function* (engine) {
		const client = yield* connect(Option.getOrThrow(engine.database).schema);
		engine.other = Option.some({ changes: makeChanges(client).changes, client });
	});
}

export function slowCommits() {
	return prisma.trait("fixtures", "a deferred trigger delays COMMIT", function* (engine) {
		const { schema, execute } = Option.getOrThrow(engine.database);
		yield* execute(
			`create function "${schema}".slow_commit() returns trigger language plpgsql as $$ begin perform pg_sleep(1); return null; end $$`,
			`create constraint trigger slow_commit after insert on "${schema}".changes_prisma_order
			deferrable initially deferred for each row execute function "${schema}".slow_commit()`,
		);
	});
}

export function slowWrites() {
	return prisma.trait("fixtures", "an insert trigger delays order writes", function* (engine) {
		const { schema, execute } = Option.getOrThrow(engine.database);
		yield* execute(
			`create function "${schema}".slow_insert() returns trigger language plpgsql as $$ begin perform pg_sleep(0.3); return new; end $$`,
			`create trigger slow_insert before insert on "${schema}".changes_prisma_order for each row execute function "${schema}".slow_insert()`,
		);
	});
}

export function hasLookupTable() {
	return prisma.trait("fixtures", "a lookup table can be read without writing it", function* (engine) {
		const { schema, execute } = Option.getOrThrow(engine.database);
		yield* execute(`create table "${schema}".changes_prisma_lookup (id text primary key)`);
	});
}
