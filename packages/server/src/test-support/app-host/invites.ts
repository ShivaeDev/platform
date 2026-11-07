import { Context, Effect, Layer, Schema } from "effect";
import { SecureRandom } from "effect/crypto";
import * as Hex from "effect/encoding/Hex";
import { FetchHttpClient } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { contract } from "@shivaedev/contract/contract.ts";
import { command } from "@shivaedev/contract/operation.ts";
import { appHost } from "#appHost.ts";
import type { HostState } from "#test/app-host/state.ts";

class Issuer extends Context.Service<Issuer, string>()("@shivaedev/server/test/InviteIssuer") {}
const Invites = contract("invites", {
	commands: [command("create", { invalidates: () => [], success: Schema.Struct({ code: Schema.String, issuer: Schema.String }) })],
});

export function inviteHost(config: HostState["config"]) {
	const preflight = Layer.effect(
		Issuer,
		Effect.gen(function* () {
			const random = yield* SecureRandom.SecureRandom;
			return Hex.encode(yield* random.randomBytes(16));
		}),
	);
	return appHost({
		config,
		group: Invites,
		handlers: Invites.application.toLayer({
			"invites.create": () =>
				Effect.gen(function* () {
					const random = yield* SecureRandom.SecureRandom;
					return { code: Hex.encode(yield* random.randomBytes(8)), issuer: yield* Issuer };
				}),
		}),
		policy: "loopback",
		preflight,
	});
}

export function createInvite(url: string) {
	const protocol = RpcClient.layerProtocolHttp({ url: `${url}/rpc` }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	return RpcClient.make(Invites).pipe(
		Effect.flatMap((client) => client["invites.create"]()),
		Effect.provide(protocol),
		Effect.scoped,
	);
}
