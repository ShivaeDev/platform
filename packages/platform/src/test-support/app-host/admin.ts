import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NodeHttpPlatform, NodeServices } from "@effect/platform-node";
import { Effect, Layer, Option, Schema, Stream } from "effect";
import { HttpRouter, HttpServerRespondable, HttpStaticServer } from "effect/http";
import { Rpc, RpcGroup } from "effect/rpc";
import { AuthUnavailable, Conflict } from "#errors/taxonomy.ts";
import { SessionUser } from "#rpc/identity.ts";
import { AuthenticatedAdmin } from "#rpc/middleware.ts";
import { appHost } from "#server/appHost.ts";
import { adminRoute, authenticatedAdminLayer } from "#server/rpc-server/roles.ts";
import type { SessionPolicy, UserSessionShape } from "#server/rpc-server/session.ts";
import { staticAssets } from "./fixture.ts";
import type { HostState } from "./state.ts";
import { host } from "./story.ts";

const Admin = RpcGroup.make(
	Rpc.make("adminRead", { success: Schema.String }),
	Rpc.make("adminReject", { error: Conflict, success: Schema.String }),
	Rpc.make("adminStream", { stream: true, success: Schema.String }),
).middleware(AuthenticatedAdmin);
const Api = Admin.merge(RpcGroup.make(Rpc.make("publicRead", { success: Schema.String })));

function adminSessions(state: HostState) {
	return {
		origin: () => true,
		provider: {
			get: (headers: Readonly<Record<string, string>>) =>
				Effect.suspend(() => {
					if (state.adminSession.unavailable) {
						return Effect.fail(new AuthUnavailable({ message: "Session provider unavailable" }));
					}
					return Effect.succeed(
						headers.authorization === "member"
							? Option.some({ user: { email: "member@example.test", id: "member", name: "Member", role: state.adminSession.role } })
							: Option.none(),
					);
				}),
		},
	};
}

function adminRoutes(root: string, sessions: SessionPolicy<UserSessionShape>, state: HostState) {
	return HttpRouter.use((router) =>
		Effect.gen(function* () {
			const spa = yield* HttpStaticServer.make({ root, spa: true });
			yield* router.add(
				"*",
				"/admin/*",
				adminRoute(sessions)((request) =>
					Effect.andThen(
						Effect.sync(() => state.calls.push(request.url)),
						spa,
					).pipe(Effect.catch(HttpServerRespondable.toResponse)),
				),
			);
		}),
	).pipe(Layer.orDie, Layer.provide(NodeHttpPlatform.layer), Layer.provide(NodeServices.layer));
}

export const adminApplication = host.trait("configured", "admin routes and RPC share the session policy beside a public SPA", (state) =>
	Effect.promise(async () => {
		const files = await staticAssets();
		state.cleanup.push(files.close);
		await mkdir(join(files.path, "admin"));
		await writeFile(join(files.path, "admin", "index.html"), "<main>Hosted app</main>");
		await writeFile(join(files.path, "admin", "tools.js"), "admin tools");
		const sessions = adminSessions(state);
		const read = Effect.gen(function* () {
			state.calls.push("adminRead");
			return (yield* SessionUser).email;
		});
		const handlers = Api.toLayer({
			adminRead: () => read,
			adminReject: () =>
				Effect.andThen(
					Effect.sync(() => state.calls.push("adminReject")),
					Effect.fail(new Conflict({ message: "Read rejected" })),
				),
			adminStream: () => Stream.concat(Stream.fromEffect(read), Stream.never),
			publicRead: () => Effect.succeed("public result"),
		}).pipe(Layer.provideMerge(authenticatedAdminLayer(sessions)));
		const routes = adminRoutes(files.path, sessions, state);
		state.build = () =>
			appHost({ assets: { root: files.path, spa: true }, config: state.config, group: Api, handlers, routes, services: Layer.empty, sessions });
	}),
);

export function adminRole(role: string) {
	return host.trait("configured", `the member has the ${role} role`, (state) => {
		state.adminSession.role = role;
	});
}
export const unavailableAdminProvider = host.trait("configured", "the session provider is unavailable", (state) => {
	state.adminSession.unavailable = true;
});
