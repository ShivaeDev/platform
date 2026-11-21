import { createRoute } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";
import type { RouteContext } from "#client/Module.ts";
import { SessionModuleScreen } from "#test-support/SessionModuleScreen.tsx";

const Api = contract("privateModule", {
	keyScope: "session",
	queries: [query("read", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String })],
});

function sessionApi(registry: AtomRegistry.AtomRegistry, name: string, user: string) {
	const application = Api.application.toLayer({ "privateModule.read": () => Effect.succeed(`${name} for ${user}`) });
	return makeClient({ privateModule: Api }, { protocol: layerLiveMemoryProtocol(Api, application), registry }).api.privateModule;
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
