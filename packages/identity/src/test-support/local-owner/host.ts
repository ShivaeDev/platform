import { Duration, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { appHost } from "@shivaedev/server/appHost.ts";
import { localOwner } from "#server/localOwner.ts";
import { permissionLayer } from "#server/permissionLayer.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { authenticatedUserLayer } from "#server/session.ts";
import { Access, Api, handlers, OwnerOnly, owner } from "./api.ts";

export const REVALIDATION_INTERVAL = Duration.millis(50);

export const ownerHost = Effect.fnUntraced(function* () {
	const local = yield* localOwner({ owner, roles: Access, streamRevalidationInterval: REVALIDATION_INTERVAL });
	const audit: string[] = [];
	const context = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: Api,
			handlers: handlers(audit).pipe(Layer.provideMerge([authenticatedUserLayer(), permissionLayer(OwnerOnly)])),
			sessions: Layer.succeed(SessionPolicy, local.sessions),
		}),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("The owner story needs a TCP listener");
	}
	return { audit, local, url: `http://127.0.0.1:${server.address.port}/rpc` };
});
export type OwnerHost = Effect.Success<ReturnType<typeof ownerHost>>;
