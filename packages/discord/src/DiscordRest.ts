import { HttpClient } from "effect/http";
import { defineService } from "@shivaedev/service/defineService.ts";
import { DiscordConfig } from "#DiscordConfig.ts";
import { DiscordToken } from "#DiscordToken.ts";
import { initializeRest, restRequest } from "#restClient.ts";

export const DiscordRest = defineService({
	id: "@shivaedev/discord/DiscordRest",
	initialize: initializeRest,
	methods: (state) => ({ request: restRequest(state) }),
	requires: [HttpClient.HttpClient, DiscordToken, DiscordConfig],
});
