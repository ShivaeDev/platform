import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { confirmQueue } from "#github/confirmQueue.ts";
import { delay } from "#github/delay.ts";
import { discover } from "#github/discover.ts";
import { pacing } from "#github/pacing.ts";
import { queue } from "#github/queue.ts";
import { snapshot } from "#github/snapshot.ts";
import { GitHubHttp } from "#github-http/service.ts";

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
