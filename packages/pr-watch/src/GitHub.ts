import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { confirmQueue } from "#GitHub/confirmQueue.ts";
import { delay } from "#GitHub/delay.ts";
import { discover } from "#GitHub/discover.ts";
import { pacing } from "#GitHub/pacing.ts";
import { queue } from "#GitHub/queue.ts";
import { snapshot } from "#GitHub/snapshot.ts";
import { GitHubHttp } from "#GitHubHttp.ts";

export const GitHub = defineService({
	id: "@shivaedev/pr-watch/GitHub",
	initialize: Effect.void,
	methods: () => ({
		confirmQueue,
		delay,
		discover,
		pacing,
		queue,
		snapshot,
	}),
	requires: [GitHubHttp],
});
