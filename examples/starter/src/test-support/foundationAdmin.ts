import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect } from "effect";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Admin, foundation } from "#modules.ts";
import { startHost } from "./host.ts";
import { postgres } from "./postgres.ts";
import { mintUser } from "./sessionPrecondition.ts";

export const foundationAdmin = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const host = yield* startHost();
		return { cookies: new Map<string, string>(), host };
	},
	inspect: ({ host }) => ({ baseUrl: host.baseUrl }),
	layer: postgres,
	name: "foundation admin",
	stages: ["accounts"],
	verbs: (engine, story) => ({
		openAdmin: Effect.fn("FoundationAdmin.openAdmin")(function* (name = "visitor") {
			story.tell(`${name} opens the foundation admin RPC`);
			return yield* makeClient(foundation.UsersPage.contract, {
				group: Admin.group,
				headers: { cookie: engine.cookies.get(name) ?? "", origin: engine.host.origin },
				url: `${engine.host.baseUrl}/rpc`,
				webSocketConstructor: layerWebSocketConstructorWS,
			}).client;
		}),
		session: Effect.fn("FoundationAdmin.session")(function* (name: string) {
			story.tell(`${name} reads their session from the auth endpoint`);
			const response = yield* Effect.promise(() =>
				fetch(`${engine.host.baseUrl}/api/auth/get-session`, {
					headers: { cookie: engine.cookies.get(name) ?? "" },
				}),
			);
			const body: unknown = yield* Effect.promise(() => response.json());
			return body;
		}),
	}),
});

export function foundationAccount(name: string, role = "user") {
	return foundationAdmin.trait("accounts", `${name} has a ${role} session`, function* (engine) {
		const { headers } = yield* mintUser(engine.host, name, role);
		engine.cookies.set(name, headers.get("cookie") ?? "");
	});
}
