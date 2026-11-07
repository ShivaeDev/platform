import { Context, Effect, Layer, Queue, Redacted } from "effect";
import { FetchHttpClient } from "effect/http";
import { fakeDiscord } from "@shivaedev/test-kits/discord/fake.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { DiscordConfig } from "#DiscordConfig.ts";
import { DiscordToken } from "#DiscordToken.ts";
import { GatewayTransport } from "#GatewayTransport.ts";
import { DiscordGateway } from "#gateway/service.ts";
import type { GatewayDispatch } from "#gatewayProtocol.ts";
import { layer as restLayer } from "#rest/layer.ts";
import { DiscordRest } from "#rest/service.ts";
import { gatewayVerbs } from "#test/gatewayVerbs.ts";
import { restVerbs } from "#test/restVerbs.ts";

export const discord = storyKit({
	clock: "test",
	*create() {
		const fake = yield* fakeDiscord();
		const events = yield* Queue.unbounded<GatewayDispatch>();
		const dependencies = Layer.mergeAll(
			FetchHttpClient.layer,
			Layer.succeed(DiscordConfig)({ apiUrl: fake.server.url, gatewayUrl: "wss://gateway.discord.test", intents: 513 }),
			Layer.succeed(DiscordToken)(Redacted.make("story-discord-token")),
			Layer.succeed(GatewayTransport)(fake.gateway.transport),
		);
		const context = yield* Layer.build(Layer.mergeAll(restLayer, DiscordGateway.layer).pipe(Layer.provide(dependencies)));
		const independentRest = Layer.build(Layer.fresh(restLayer.pipe(Layer.provide(dependencies)))).pipe(
			Effect.map((built) => Context.get(built, DiscordRest)),
		);
		return { ...fake, context, events, gatewayClient: Context.get(context, DiscordGateway), independentRest };
	},
	name: "Discord bot",
	stages: ["provider"],
	verbs: (engine, story) => ({ ...gatewayVerbs(engine, story.tell), ...restVerbs(engine, story.tell) }),
});

export const rateLimited = discord.trait("provider", "Discord rate limits the next message for two seconds", ({ server }) =>
	server.scriptFault("create", { kind: "status", reply: { body: { global: false, "retry_after": 2 }, status: 429 } }),
);

export const bucketExhausted = discord.trait("provider", "Discord reports an exhausted message bucket", ({ server }) =>
	server.scriptFault("create", {
		kind: "status",
		reply: {
			body: { "channel_id": "111", content: "earlier", id: "999" },
			headers: { "x-ratelimit-bucket": "messages", "x-ratelimit-remaining": "0", "x-ratelimit-reset-after": "2" },
		},
	}),
);

export const continuouslyLimited = discord.trait("provider", "Discord keeps this channel globally rate limited", ({ server }) =>
	server.scriptFault(
		"create",
		{ kind: "status", reply: { body: { global: true, "retry_after": 2 }, status: 429 } },
		{ params: { channel: "111" }, repeat: true },
	),
);
