import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect } from "effect";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Admin, foundation } from "#admin/modules.ts";
import { answer } from "#test-support/answers.ts";
import { startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";
import { sessionPermissions } from "./session.ts";

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
	verbs: (engine, story) => {
		const adminOf = Effect.fn("FoundationAdmin.adminOf")(function* (name: string) {
			return yield* makeClient(foundation.UsersPage.contract, {
				group: Admin.group,
				headers: { cookie: engine.cookies.get(name) ?? "", origin: engine.host.origin },
				url: `${engine.host.baseUrl}/rpc`,
				webSocketConstructor: layerWebSocketConstructorWS,
			}).client;
		});
		return {
			jobHealth: Effect.fn("FoundationAdmin.jobHealth")(function* (name: string) {
				story.tell(`${name} reads the job health page`);
				const admin = yield* adminOf(name);
				return yield* answer(
					Effect.map(admin["admin.jobs.health"](), ({ activeTotal, failedTotal }) => ({ active: activeTotal, failed: failedTotal })),
				);
			}),
			permissions: Effect.fn("FoundationAdmin.permissions")(function* (name: string) {
				story.tell(`${name} reads her session's permissions`);
				return yield* sessionPermissions(engine.host.baseUrl, engine.cookies.get(name) ?? "");
			}),
			users: Effect.fn("FoundationAdmin.users")(function* (name: string) {
				story.tell(`${name} reads the users page`);
				const admin = yield* adminOf(name);
				return yield* answer(Effect.map(admin["admin.users.list"]({ limit: 20 }), ({ users }) => users.map(({ email }) => email)));
			}),
		};
	},
});

export function foundationAccount(name: string, role = "user") {
	return foundationAdmin.trait("accounts", `${name} is signed in as ${role === "user" ? "a" : "an"} ${role}`, function* (engine) {
		const { headers } = yield* mintUser(engine.host, name, role);
		engine.cookies.set(name, headers.get("cookie") ?? "");
	});
}
