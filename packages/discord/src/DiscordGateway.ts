import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { DiscordConfig } from "#DiscordConfig.ts";
import { DiscordToken } from "#DiscordToken.ts";
import { GatewayTransport } from "#GatewayTransport.ts";
import { runGateway } from "#runGateway.ts";

export const DiscordGateway = defineService({
	id: "@shivaedev/discord/DiscordGateway",
	initialize: Effect.void,
	methods: () => ({ run: runGateway }),
	requires: [DiscordConfig, DiscordToken, GatewayTransport],
});
