import { Context, Effect, Layer, Option, type Redacted } from "effect";
import { type Headers, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { appHost } from "@shivaedev/server/appHost.ts";
import { SettingsRpc } from "./contract.ts";
import { handlers } from "./handlers.ts";
import { migrations, repositories } from "./repository.ts";
import { SettingsService } from "./Service.ts";

export const startHost = Effect.fn("Settings.startHost")(function* (
	databaseUrl: Redacted.Redacted<string>,
	beforeCommit: (keys: readonly unknown[]) => Effect.Effect<void> = () => Effect.void,
) {
	const sessions = new Map([
		["Bearer alice-session", "alice"],
		["Bearer bob-session", "bob"],
	]);
	const context = yield* Layer.build(
		appHost({
			config: { databaseUrl, port: 0 },
			group: SettingsRpc,
			handlers: handlers(beforeCommit),
			migrations,
			services: SettingsService.layer.pipe(Layer.provide(repositories)),
			sessions: {
				origin: () => true,
				provider: {
					get: (headers: Headers.Headers) =>
						Effect.succeed(Option.map(Option.fromUndefinedOr(sessions.get(headers.authorization ?? "")), (id) => ({ user: { id } }))),
				},
			},
		}),
	);
	const server = Context.get(context, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die(new Error("Expected a TCP host"));
	}
	return { url: `http://127.0.0.1:${server.address.port}/rpc` };
});
