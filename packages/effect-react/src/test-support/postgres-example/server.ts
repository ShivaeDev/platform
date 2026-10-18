import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Layer, ManagedRuntime, Option, Redacted } from "effect";
import { type Headers, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { SqlClient } from "effect/sql";
import { type AppDatabaseOptions, appHost } from "@shivaedev/platform/server/appHost.ts";
import { LiveOrders, type Rejected } from "./contract.ts";
import { OrderService } from "./OrderService.ts";
import { orderHandlers } from "./orderHandlers.ts";
import { orderMigrations, repositoryLayer } from "./repository.ts";

export interface ServerOptions {
	readonly applicationName?: string;
	readonly beforeCommit?: Effect.Effect<void, Rejected>;
	readonly channel?: string;
	readonly keepTables?: boolean;
	readonly ledger?: string;
	readonly table?: string;
}

export async function startServer(databaseUrl: string, options: ServerOptions = {}) {
	const suffix = crypto.randomUUID().replaceAll("-", "");
	const table = options.table ?? `composed_orders_${suffix}`;
	const ledger = options.ledger ?? `composed_migrations_${suffix}`;
	function pool() {
		return PgClient.layer({
			url: Redacted.make(databaseUrl),
			...(options.applicationName === undefined ? {} : { applicationName: options.applicationName }),
		});
	}
	const observer = ManagedRuntime.make(pool());
	function read() {
		return observer.runPromise(
			SqlClient.SqlClient.use(
				(sql) => sql<{ readonly name: string; readonly quantity: number }>`select name, quantity from ${sql(table)} where id = 1`,
			),
		);
	}
	const { handlers, publications, delivered, reads } = orderHandlers(read, options.beforeCommit);
	const sessions = new Map([
		["Bearer alice-session", "alice"],
		["Bearer bob-session", "bob"],
	]);
	const policy = {
		origin: () => true,
		provider: {
			get: (headers: Headers.Headers) =>
				Effect.succeed(Option.map(Option.fromUndefinedOr(sessions.get(headers.authorization ?? "")), (id) => ({ user: { id } }))),
		},
	};
	const changes: NonNullable<AppDatabaseOptions["config"]> =
		options.channel === undefined
			? {}
			: {
					changes: {
						channel: options.channel,
						heartbeatInterval: "100 millis",
						heartbeatTimeout: "300 millis",
						retryDelay: "50 millis",
					},
				};
	const runtime = ManagedRuntime.make(
		appHost({
			config: {
				...(options.applicationName === undefined ? {} : { applicationName: options.applicationName }),
				databaseUrl: Redacted.make(databaseUrl),
				port: 0,
				...changes,
			},
			group: LiveOrders,
			handlers,
			migrations: { loader: orderMigrations(table), table: ledger },
			services: OrderService.layer.pipe(Layer.provide(repositoryLayer(table))),
			sessions: policy,
		}),
	);
	async function close() {
		try {
			await runtime.dispose();
		} finally {
			try {
				if (!options.keepTables) {
					await observer.runPromise(SqlClient.SqlClient.use((sql) => sql`drop table if exists ${sql(table)}, ${sql(ledger)}`));
				}
			} finally {
				await observer.dispose();
			}
		}
	}
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		if (!NetAddress.isInetAddress(server.address)) {
			throw new Error("Expected a loopback TCP server");
		}
		return { close, delivered, publications, read, reads, url: `http://${NetAddress.formatIp(server.address.address)}:${server.address.port}/rpc` };
	} catch (error) {
		await close();
		throw error;
	}
}
