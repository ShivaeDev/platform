import { createRoute } from "@tanstack/react-router";
import { Effect, Layer, Schema } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import type { RouteContext } from "#client/Module.ts";
import { SessionModuleScreen } from "./SessionModuleScreen.tsx";

const Api = contract("privateModule", {
	keyScope: "session",
	queries: [query("read", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String })],
});

function sessionApi(registry: AtomRegistry.AtomRegistry, name: string, user: string) {
	const application = Api.application.toLayer({ "privateModule.read": () => Effect.succeed(`${name} for ${user}`) });
	class Client extends AtomRpc.Service<Client>()(`test/SessionModule/${name}`, {
		group: Api,
		makeEffect: RpcTest.makeClient(Api, { flatten: true }),
		protocol: Layer.merge(application, hostChanges(Api).pipe(Layer.provide(application))),
	}) {}
	return bind(Api, Client, { registry });
}

export type SessionModuleApi = ReturnType<typeof sessionApi>;

export function sessionModule(name: string, user: string) {
	return Effect.map(AtomRegistry.AtomRegistry, (registry) => {
		const api = sessionApi(registry, name, user);
		return {
			api,
			routes: ({ getParentRoute }: RouteContext) => [
				createRoute({ component: () => <SessionModuleScreen api={api} />, getParentRoute, path: `/${name}` }),
			],
		};
	});
}
