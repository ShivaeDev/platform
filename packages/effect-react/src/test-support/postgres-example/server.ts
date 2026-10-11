import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Layer, ManagedRuntime, Option, Redacted } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { SqlClient } from "effect/unstable/sql";
import { authenticatedLayer } from "@shivaedev/platform/rpc-server/session.ts";
import { LiveOrders, type Rejected } from "./contract.ts";
import { OrderService } from "./OrderService.ts";
import { orderHandlers } from "./orderHandlers.ts";
import { repositoryLayer } from "./repository.ts";

export interface ServerOptions {
	readonly beforeCommit?: Effect.Effect<void, Rejected>;
}

export async function startServer(databaseUrl: string, options: ServerOptions = {}) {
	const suffix = crypto.randomUUID().replaceAll("-", "");
	const table = `composed_orders_${suffix}`;
	const ledger = `composed_migrations_${suffix}`;
	function pool() {
		return PgClient.layer({ url: Redacted.make(databaseUrl) });
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
	const service = OrderService.layer.pipe(Layer.provide(repositoryLayer(table, ledger)), Layer.provideMerge(Layer.merge(pool(), Reactivity.layer)));
	const sessions = new Map([
		["Bearer alice-session", "alice"],
		["Bearer bob-session", "bob"],
	]);
	const authentication = authenticatedLayer({
		origin: () => true,
		provider: {
			get: (headers) => Effect.succeed(Option.map(Option.fromUndefinedOr(sessions.get(headers.authorization ?? "")), (id) => ({ user: { id } }))),
		},
	});
	const routes = RpcServer.layerHttp({ group: LiveOrders, path: "/rpc", protocol: "http" }).pipe(
		Layer.provide([handlers, authentication, RpcSerialization.layerNdjson]),
	);
	const runtime = ManagedRuntime.make(
		HttpRouter.serve(routes, { disableLogger: true }).pipe(
			Layer.provideMerge(service),
			Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
		),
	);
	async function close() {
		try {
			await runtime.dispose();
		} finally {
			try {
				await observer.runPromise(SqlClient.SqlClient.use((sql) => sql`drop table if exists ${sql(table)}, ${sql(ledger)}`));
			} finally {
				await observer.dispose();
			}
		}
	}
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		if (server.address._tag !== "TcpAddress") {
			throw new Error("Expected a loopback TCP server");
		}
		return { close, delivered, publications, read, reads, url: `http://${server.address.hostname}:${server.address.port}/rpc` };
	} catch (error) {
		await close();
		throw error;
	}
}
