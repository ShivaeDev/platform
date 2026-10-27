import { Context, Effect, Layer, Schema } from "effect";
import { Crypto } from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import { FetchHttpClient } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { contract } from "@shivaedev/contract/contract.ts";
import { command } from "@shivaedev/contract/operation.ts";
import { appHost } from "#appHost.ts";
import type { HostState } from "./state.ts";

class Issuer extends Context.Service<Issuer, string>()("@test/InviteIssuer") {}
const Invites = contract("invites", {
	commands: [command("create", { invalidates: () => [], success: Schema.Struct({ code: Schema.String, issuer: Schema.String }) })],
});

export function inviteHost(config: HostState["config"]) {
	const preflight = Layer.effect(
		Issuer,
		Effect.gen(function* () {
			const crypto = yield* Crypto;
			return Hex.encode(yield* crypto.randomBytes(16));
		}),
	);
	return appHost({
		config,
		group: Invites,
		handlers: Invites.application.toLayer({
			"invites.create": () =>
				Effect.gen(function* () {
					const crypto = yield* Crypto;
					return { code: Hex.encode(yield* crypto.randomBytes(8)), issuer: yield* Issuer };
				}).pipe(Effect.orDie),
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
