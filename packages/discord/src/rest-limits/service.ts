import { defineService } from "@shivaedev/service/defineService.ts";
import { initialize } from "./initialize.ts";
import { observe } from "./observe.ts";
import { refuse } from "./refuse.ts";
import { wait } from "./wait.ts";

export const DiscordRestLimits = defineService({
	id: "@shivaedev/discord/DiscordRestLimits",
	initialize,
	methods: (state) => ({ observe: observe(state), refuse: refuse(state), wait: wait(state) }),
	requires: [],
});
