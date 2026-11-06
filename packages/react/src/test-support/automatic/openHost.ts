import { Effect, Layer, ManagedRuntime, type Redacted } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcMiddleware } from "effect/rpc";
import { appHost } from "@shivaedev/server/appDatabase.ts";
import { Api, migrations, Preview, repository } from "./feature.ts";

class Observed extends RpcMiddleware.Service<Observed>()("@shivaedev/react/test/AutomaticRequests") {}

export async function openHost(databaseUrl: Redacted.Redacted<string>) {
	const reads: number[] = [];
	const requests: string[] = [];
	const readers = new Set<(id: number) => void>();
	function read(id: number) {
		reads.push(id);
		for (const reader of [...readers]) {
			reader(id);
		}
	}
	function nextRead(id: number) {
		return new Promise<void>((resolve) => {
			function reader(readId: number) {
				if (readId === id) {
					readers.delete(reader);
					resolve();
				}
			}
			readers.add(reader);
		});
	}
	const publications: string[] = [];
	const application = Api.application.merge(Preview.application);
	const handlers = application.toLayer(
		Effect.gen(function* () {
			const rows = yield* repository;
			const reactivity = yield* Reactivity.Reactivity;
			for (const key of ["notes", "notes:1", "notes:2", "summary"]) {
				yield* Effect.acquireRelease(
					Effect.sync(() => reactivity.registerUnsafe([key], () => publications.push(key))),
					(cancel) => Effect.sync(cancel),
				);
			}
			return application.of({
				"notes.get": ({ id }) => Effect.sync(() => read(id)).pipe(Effect.andThen(rows.findById(id)), Effect.orDie),
				"notes.rename": (input) => rows.update(input).pipe(Effect.orDie),
				"preview.get": ({ id }) => Effect.sync(() => read(id)).pipe(Effect.andThen(rows.findById(id)), Effect.orDie),
			});
		}),
	);
	const runtime = ManagedRuntime.make(
		appHost({
			config: { applicationName: "automatic-web", databaseUrl, port: 0 },
			group: Api.merge(Preview).middleware(Observed),
			handlers: Layer.merge(
				handlers,
				Layer.succeed(Observed, (effect, { rpc }) =>
					Effect.andThen(
						Effect.sync(() => requests.push(rpc._tag)),
						effect,
					),
				),
			),
			migrations: { ...migrations, mode: "check" },
			policy: "loopback",
			postgresSettings: {},
		}),
	);
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		if (!NetAddress.isInetAddress(server.address)) {
			throw new Error("Expected TCP host");
		}
		return { close: () => runtime.dispose(), nextRead, publications, reads, requests, url: `http://127.0.0.1:${server.address.port}/rpc` };
	} catch (error) {
		await runtime.dispose();
		throw error;
	}
}
