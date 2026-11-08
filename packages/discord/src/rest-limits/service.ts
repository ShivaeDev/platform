import { defineService } from "@shivaedev/service/defineService.ts";
import { initialize } from "#rest-limits/initialize.ts";
import { observe } from "#rest-limits/observe.ts";
import { refuse } from "#rest-limits/refuse.ts";
import { wait } from "#rest-limits/wait.ts";

export const DiscordRestLimits = defineService({
	id: "@shivaedev/discord/DiscordRestLimits",
	initialize,
	methods: (state) => ({ observe: observe(state), refuse: refuse(state), wait: wait(state) }),
	requires: [],
});
