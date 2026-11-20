import { Cause, ConfigProvider, Effect, ErrorReporter, Layer, Logger } from "effect";
import { FetchHttpClient, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { TestClock } from "effect/testing";
import { JobsClientFactory } from "@shivaedev/jobs/server/JobsClientFactory.ts";
import { pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { makePgBossTesting } from "@shivaedev/test-kits/jobs/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { type OtlpSpan, otlpReceiver } from "@shivaedev/test-story/server/otlpReceiver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appHost } from "#appDatabase.ts";
import { appModules } from "#appModules.ts";
import { indexingModule, Published, Publisher, PublishingApi, publishingModule } from "#test/modules/jobs.ts";
import { MemberCardsApi, memberCardsModule } from "#test/modules/memberCards.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";
import { workerHost } from "#workerHost.ts";

interface State {
	collector?: { readonly untilSpan: (name: string) => Effect.Effect<OtlpSpan, unknown> };
	collision?: "shared" | "separate" | "within";
	readonly env: Record<string, string>;
	failure?: { readonly queue: string; readonly firstModule: string; readonly secondModule: string };
	replaced: boolean;
	readonly reported: Cause.Cause<unknown>[];
	readonly sender: ReturnType<typeof makePgBossTesting>;
	sensitiveKeys?: readonly string[];
	readonly testing: ReturnType<typeof makePgBossTesting>;
	url: string;
	readonly workerLogs: { readonly cause: Cause.Cause<unknown>; readonly message: readonly unknown[] }[];
}

function attributeValue(span: OtlpSpan, key: string): unknown {
	const value = span.attributes.find((attribute) => attribute.key === key)?.value;
	const entry = typeof value === "object" && value !== null ? Object.values(value)[0] : value;
	return typeof entry === "string" && entry.startsWith("{") ? JSON.parse(entry) : entry;
}

export const moduleWorkers = storyKit({
	after: {
		configured: Effect.fnUntraced(function* (state) {
			const database = yield* PostgresTestDatabase;
			const publishing = state.collision === "within" ? { ...publishingModule, queues: [Published, Published] } : publishingModule;
			const indexingQueues = state.collision === "shared" ? [Published] : [{ name: Published.name }];
			const indexing =
				state.collision === "shared" || state.collision === "separate" ? { ...indexingModule, queues: indexingQueues } : indexingModule;
			const modules = yield* appModules([publishing, indexing, memberCardsModule], {
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
			const jobs = pgBossLayer({ connectionString: database.url, migrate: false, supervise: false }).pipe(
				Layer.provide(Layer.succeed(JobsClientFactory, state.testing.clientFactory)),
			);
			const services = modules.services.pipe(Layer.provideMerge(jobs));
			const hostServices = modules.services.pipe(
				Layer.provide(
					pgBossLayer({ connectionString: database.url, migrate: false, supervise: false }).pipe(
						Layer.provide(Layer.succeed(JobsClientFactory, state.sender.clientFactory)),
					),
				),
			);
			const config = { databaseUrl: database.url, port: 0 };
			const host = yield* Layer.build(appHost({ postgresSettings: {}, ...modules, config, policy: "loopback", services: hostServices }));
			const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(host));
			if (!NetAddress.isInetAddress(server.address)) {
				return yield* Effect.die("Expected TCP address");
			}
			state.url = `http://127.0.0.1:${server.address.port}/rpc`;
			const recorded = Logger.make(({ cause, message }) => {
				state.workerLogs.push({ cause, message: Array.isArray(message) ? message : [message] });
			});
			const reporter = ErrorReporter.make(({ cause }) => {
				state.reported.push(cause);
			});
			const workerConfig = { ...config, ...(state.sensitiveKeys === undefined ? {} : { sensitiveKeys: state.sensitiveKeys }) };
			yield* Layer.build(
				workerHost({ postgresSettings: {}, ...modules, config: workerConfig, migrations: { ...modules.migrations, mode: "check" }, services }).pipe(
					Layer.provide([
						Logger.layer([recorded]),
						ErrorReporter.layer([reporter]),
						ConfigProvider.layer(ConfigProvider.fromEnv({ env: state.env })),
					]),
				),
			);
		}),
	},
	around: withIsolatedDatabase,
	clock: "test",
	*create(): Effect.fn.Return<State> {
		const clock = yield* TestClock.testClockWith(Effect.succeed);
		return {
			env: {},
			replaced: false,
			reported: [],
			sender: makePgBossTesting({ clock }),
			testing: makePgBossTesting({ clock }),
			url: "",
			workerLogs: [],
		};
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
		function members() {
			return RpcClient.make(MemberCardsApi).pipe(
				Effect.provide(RpcClient.layerProtocolHttp({ url: state.url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]))),
			);
		}
		function workerLog(message: string) {
			return state.workerLogs.find((entry) => entry.message[0] === message);
		}
		return {
			auditMember: (id: number) => {
				story.tell(`a visitor asks for an audit of member ${id}, whose job dies holding the member's row and logs and reports its defect`);
				return Effect.flatMap(members(), (api) => api.audit({ id }));
			},
			billMember: (id: number) => {
				story.tell(`a visitor bills member ${id}, whose job logs the member's computed customerReference`);
				return Effect.flatMap(members(), (api) => api.bill({ id }));
			},
			complete: () => state.testing.waitForIdle,
			exportedCardSpan: () =>
				Effect.gen(function* () {
					if (state.collector === undefined) {
						return yield* Effect.die("Give the worker a collector before reading its exported spans");
					}
					return attributeValue(yield* state.collector.untilSpan("members.card"), "member");
				}),
			index: (title: string) => {
				story.tell(`a visitor submits ${title} to indexing over HTTP`);
				return Effect.flatMap(client(), (api) => api.index({ title }));
			},
			joinMember: (name: string, address: string) => {
				story.tell(`a visitor adds the member ${name} living at ${address} over HTTP`);
				return Effect.flatMap(members(), (api) => api.join({ address, name }));
			},
			preview: (title: string) => Effect.flatMap(client(), (api) => api.preview({ title })),
			printCard: (id: number) => {
				story.tell(`a visitor asks for a card for member ${id}, whose job logs the member's row and stores the address it prints`);
				return Effect.flatMap(members(), (api) => api.printCard({ id }));
			},
			printedAddresses: () => Effect.flatMap(members(), (api) => api.printedAddresses()),
			publish: (title: string) => {
				story.tell(`a visitor submits ${title} to publishing over HTTP`);
				return Effect.flatMap(client(), (api) => api.publish({ title }));
			},
			published: () => Effect.flatMap(client(), (api) => api.published()),
			queueConflict: () => Effect.sync(() => state.failure),
			recordedWorkerDefect: (message: string) =>
				Effect.sync(() => workerLog(message)?.cause.reasons.find(Cause.isDieReason)?.defect ?? `no worker log ${message} holds a defect`),
			recordedWorkerLog: (message: string) => Effect.sync(() => workerLog(message)?.message[1] ?? `no worker log ${message}`),
			reportedWorkerDefect: () =>
				Effect.sync(() => state.reported.flatMap((cause) => cause.reasons.filter(Cause.isDieReason))[0]?.defect ?? "no defect was reported"),
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

export function sensitiveKeys(...keys: readonly string[]) {
	return moduleWorkers.trait("configured", `the worker host lists ${keys.join(", ")} in config.sensitiveKeys`, (state) => {
		state.sensitiveKeys = keys;
	});
}

export const collector = moduleWorkers.trait("configured", "the worker exports each span to a loopback OTLP collector as it ends", (state) =>
	Effect.gen(function* () {
		const receiver = yield* otlpReceiver();
		state.collector = {
			untilSpan: (name) => receiver.untilSpan((span) => span.name === name, { name: `${name} span reaches the collector` }),
		};
		Object.assign(state.env, { "OTEL_BSP_MAX_EXPORT_BATCH_SIZE": "1", "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url });
	}),
);
