import { Effect, Schema } from "effect";
import { Crypto } from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { storyKit } from "#storyKit.ts";

const Invites = RpcGroup.make(Rpc.make("createInvite", { success: Schema.String }));
const handlers = Invites.toLayer({
	createInvite: () =>
		Effect.gen(function* () {
			const crypto = yield* Crypto;
			return Hex.encode(yield* crypto.randomBytes(8));
		}).pipe(Effect.orDie),
});

export const invites = storyKit({
	*create() {
		const client = yield* RpcTest.makeClient(Invites).pipe(Effect.provide(handlers));
		return { client };
	},
	name: "invites",
	stages: [],
	verbs: ({ client }, story) => ({
		createInvite: () => {
			story.tell("the client requests an invite code");
			return client.createInvite();
		},
	}),
});
