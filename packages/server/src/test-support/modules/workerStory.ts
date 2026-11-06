import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { TestClock } from "effect/testing";
import { pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { makePgBossTesting } from "@shivaedev/test-kits/jobs/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appHost } from "#appDatabase.ts";
import { appModules } from "#appModules.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";
import { workerHost } from "#workerHost.ts";
import { indexingModule, Published, Publisher, PublishingApi, publishingModule } from "./jobs.ts";

interface State {
	collision?: "shared" | "separate" | "within";
	failure?: { readonly queue: string; readonly firstModule: string; readonly secondModule: string };
	replaced: boolean;
	readonly sender: ReturnType<typeof makePgBossTesting>;
	readonly testing: ReturnType<typeof makePgBossTesting>;
	url: string;
}

export const moduleWorkers = storyKit({
	after: {
		configured: Effect.fnUntraced(function* (state) {
			const database = yield* PostgresTestDatabase;
			const publishing = state.collision === "within" ? { ...publishingModule, queues: [Published, Published] } : publishingModule;
			const indexingQueues = state.collision === "shared" ? [Published] : [{ name: Published.name }];
			const indexing =
				state.collision === "shared" || state.collision === "separate" ? { ...indexingModule, queues: indexingQueues } : indexingModule;
			const modules = yield* appModules([publishing, indexing], {
				replacements: state.replaced ? Layer.succeed(Publisher, (title) => Effect.succeed(`Replacement: ${title}`)) : Layer.empty,
			}).pipe(
				Effect.catchTag("DuplicateModuleQueue", (failure) =>
					Effect.sync(() => {
						state.failure = { firstModule: failure.firstModule, queue: failure.queue, secondModule: failure.secondModule };
					}),
				),
			);
			if (modules === undefined) {
				return;
			}
			const jobs = pgBossLayer({ clientFactory: state.testing.clientFactory, connectionString: database.url, migrate: false, supervise: false });
			const services = modules.services.pipe(Layer.provideMerge(jobs));
			const hostServices = modules.services.pipe(
				Layer.provide(pgBossLayer({ clientFactory: state.sender.clientFactory, connectionString: database.url, migrate: false, supervise: false })),
			);
			const config = { databaseUrl: database.url, port: 0 };
			const host = yield* Layer.build(appHost({ postgresSettings: {}, ...modules, config, policy: "loopback", services: hostServices }));
			const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(host));
			if (!NetAddress.isInetAddress(server.address)) {
				return yield* Effect.die("Expected TCP address");
			}
			state.url = `http://127.0.0.1:${server.address.port}/rpc`;
			yield* Layer.build(workerHost({ postgresSettings: {}, ...modules, config, migrations: { ...modules.migrations, mode: "check" }, services }));
		}),
	},
	around: withIsolatedDatabase,
	clock: "test",
	*create(): Effect.fn.Return<State> {
		const clock = yield* TestClock.testClockWith(Effect.succeed);
		return { replaced: false, sender: makePgBossTesting({ clock }), testing: makePgBossTesting({ clock }), url: "" };
	},
	layer: postgres,
	name: "module workers",
	runIf: databaseUrl !== undefined,
	stages: ["configured"],
	verbs: (state, story) => {
		function client() {
			return RpcClient.make(PublishingApi).pipe(
				Effect.provide(RpcClient.layerProtocolHttp({ url: state.url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]))),
			);
		}
		return {
			complete: () => state.testing.waitForIdle,
			index: (title: string) => {
				story.tell(`a visitor submits ${title} to indexing over HTTP`);
				return Effect.flatMap(client(), (api) => api.index({ title }));
			},
			preview: (title: string) => Effect.flatMap(client(), (api) => api.preview({ title })),
			publish: (title: string) => {
				story.tell(`a visitor submits ${title} to publishing over HTTP`);
				return Effect.flatMap(client(), (api) => api.publish({ title }));
			},
			published: () => Effect.flatMap(client(), (api) => api.published()),
			queueConflict: () => Effect.sync(() => state.failure),
		};
	},
});

export const replacedPublisher = moduleWorkers.trait("configured", "the application replaces the publisher once", (state) => {
	state.replaced = true;
});

export function duplicateQueue(kind: NonNullable<State["collision"]>) {
	return moduleWorkers.trait("configured", `${kind} queue declarations collide`, (state) => {
		state.collision = kind;
	});
}
