import { Context, Effect, Layer, Option, Ref } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { liveChannel, liveHost } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";
import { rpcSocketHost } from "@shivaedev/test-story/server/rpcSocketHost.ts";
import { adminRegistry } from "#registry.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { Access } from "#test/Access.ts";
import { clientRuntime } from "#test/clientRuntime.ts";
import { OpenTasks, Tasks } from "#test/Tasks.ts";
import { TasksPage } from "#test/TasksPage.ts";

const AUDITOR = { email: "alice@example.test", emailVerified: true, id: "alice", name: "alice", role: "auditor" } as const;

export const tasksEngine = Effect.gen(function* () {
	const open = yield* Ref.make<readonly string[]>([]);
	const channel = yield* Layer.build(liveChannel());
	const registration = registerAdmin(adminRegistry(TasksPage), { tasks: Tasks });
	const host = yield* liveHost(registration.group, registration.handlers.pipe(Layer.provide(Layer.succeed(OpenTasks, open))), {
		channel: Layer.succeedContext(channel),
		protocol: "websocket",
	});
	const policy = { origin: () => true, provider: { get: () => Effect.succeed(Option.some({ user: AUDITOR })) }, roles: Access };
	const served = yield* rpcSocketHost(host.group, host.handlers.pipe(Layer.provide(Layer.succeed(SessionPolicy, policy))));
	const url = served.url.replace(/^http/u, "ws");
	const protocol = RpcClient.layerProtocolSocket().pipe(
		Layer.provide([Socket.layerWebSocket(url).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal)), RpcSerialization.layerNdjson]),
	);
	const transport = makeClient({ tasks: TasksPage.contract }, { protocol, runtime: yield* clientRuntime, url });
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	const list = transport.api.tasks.open.query();
	return {
		api: transport.api.tasks,
		close: (title: string) => AtomRegistry.getResult(registry, transport.runtime.atom(transport.api.tasks.close.run({ title }))),
		list,
		open,
		// What a write outside the page publishes on commit, such as a repository insert into the tasks table.
		publish: (keys: readonly string[]) =>
			Reactivity.invalidate(keys).pipe(Effect.provideService(Reactivity.Reactivity, Context.get(channel, Reactivity.Reactivity))),
		registry,
	};
});
