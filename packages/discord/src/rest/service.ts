import { HttpClient } from "effect/http";
import { defineService } from "@shivaedev/service/defineService.ts";
import { DiscordConfig } from "#DiscordConfig.ts";
import { DiscordToken } from "#DiscordToken.ts";
import { DiscordRestLimits } from "#rest-limits/service.ts";
import { initialize } from "./initialize.ts";
import { request } from "./request.ts";

export const DiscordRest = defineService({
	id: "@shivaedev/discord/DiscordRest",
	initialize,
	methods: (state) => ({ request: request(state) }),
	requires: [HttpClient.HttpClient, DiscordToken, DiscordConfig, DiscordRestLimits],
});
