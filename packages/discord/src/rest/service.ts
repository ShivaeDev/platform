import { HttpClient } from "effect/http";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { DiscordConfig } from "#DiscordConfig.ts";
import { DiscordToken } from "#DiscordToken.ts";
import { initialize } from "#rest/initialize.ts";
import { request } from "#rest/request.ts";
import { DiscordRestLimits } from "#rest-limits/service.ts";

export const DiscordRest = defineService({
	id: "@shivaedev/discord/DiscordRest",
	initialize,
	methods: (state) => ({ request: request(state) }),
	requires: [HttpClient.HttpClient, DiscordToken, DiscordConfig, DiscordRestLimits],
});
