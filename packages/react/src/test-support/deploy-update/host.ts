import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { appHost } from "@shivaedev/server/appHost.ts";

export const App = contract("deployFixture", {
	queries: [query("read", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String })],
});

export async function startHost(buildVersion: string | undefined, port = 0) {
	const runtime = ManagedRuntime.make(
		appHost({
			config: { ...(buildVersion === undefined ? {} : { buildVersion }), gracefulShutdownTimeout: "100 millis", port },
			group: App,
			handlers: App.application.toLayer({ "deployFixture.read": () => Effect.succeed("Application ready") }),
			policy: "loopback",
			services: Layer.empty,
		}),
	);
	const { address } = await runtime.runPromise(HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(address)) {
		throw new Error("Expected a TCP listener");
	}
	return { buildVersion, close: () => runtime.dispose(), port: address.port, url: `http://127.0.0.1:${address.port}/rpc` };
}
