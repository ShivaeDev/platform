import { Effect, Layer, Option, Predicate } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpServer, HttpServerResponse } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { permissionGuard } from "@shivaedev/react/permissionGuard.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { adminPermissionGuard } from "#client/adapters/adminPermissionGuard.ts";
import { adminDocuments } from "#server/adminDocuments.ts";
import { answered } from "./answers.ts";
import { WorkspaceAccess, type WorkspaceRole, Workspaces, workspaceRegistration } from "./workspaces.ts";

function sessionFor(role: string | undefined) {
	return role === undefined ? Option.none() : Option.some({ user: { email: "reader@app.test", id: "reader", name: "reader", role } });
}

export function workspaceSessions() {
	return {
		origin: () => true,
		provider: { get: (headers: Readonly<Record<string, string>>) => Effect.succeed(sessionFor(headers.authorization)) },
		roles: WorkspaceAccess,
	};
}

function workspaceHost(documents = true) {
	return appHost({
		config: { host: "127.0.0.1", port: 0 },
		group: workspaceRegistration.group,
		handlers: workspaceRegistration.handlers,
		routes: documents
			? adminDocuments(workspaceRegistration, (request) => Effect.succeed(HttpServerResponse.html(`<main>Workspaces: ${request.url}</main>`)))
			: Layer.empty,
		services: Layer.empty,
		sessions: Layer.succeed(SessionPolicy, workspaceSessions()),
	});
}

export const workspaceServer = Effect.gen(function* () {
	const context = yield* Layer.build(workspaceHost());
	const { address } = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(address)) {
		throw new Error("The admin host must listen on TCP");
	}
	return { url: `http://127.0.0.1:${address.port}` };
});

export const pageHost = storyKit({
	clock: "live",
	create: () => workspaceServer,
	name: "admin page host",
	stages: [],
	verbs: ({ url }, story) => ({
		openClientAsVisitor: (path: string) => {
			story.tell(`a visitor navigates to ${path} on the client`);
			return Effect.sync(() => {
				try {
					adminPermissionGuard(
						workspaceRegistration.pages,
						permissionGuard({ session: () => undefined, signIn: "/sign-in" }),
					)({
						location: { href: path, pathname: path },
						matches: [],
					});
					return "allowed";
				} catch (error) {
					if (error instanceof Response && Predicate.hasProperty(error, "options") && Predicate.hasProperty(error.options, "to")) {
						return error.options.to;
					}
					throw error;
				}
			});
		},
		openDocument: (path: string, role?: WorkspaceRole) => {
			story.tell(`${role ?? "a visitor"} opens ${path}`);
			return Effect.promise(async () => {
				const response = await fetch(`${url}${path}`, { headers: role === undefined ? {} : { authorization: role } });
				return { body: await response.text(), status: response.status };
			});
		},
		readWorkspace: (role: WorkspaceRole) =>
			Effect.gen(function* () {
				story.tell(`${role} reads workspace studio through RPC`);
				const protocol = RpcClient.layerProtocolHttp({
					transformClient: HttpClient.mapRequest(HttpClientRequest.setHeader("authorization", role)),
					url: `${url}/rpc`,
				}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
				const { client } = makeClient(Workspaces.contract, { headers: { authorization: role }, live: false, protocol, url: `${url}/rpc` });
				return yield* answered(Effect.flatMap(client, (rpc) => rpc["admin.workspaces.read"]({ id: "studio" })));
			}),
	}),
});
