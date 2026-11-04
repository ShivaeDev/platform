import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { GitHub } from "#GitHub.ts";
import { StateFile } from "#StateFile.ts";
import { delay } from "#Watcher/delay.ts";
import { initializeWatcher } from "#Watcher/initialize.ts";
import { load } from "#Watcher/load.ts";
import { pacing } from "#Watcher/pacing.ts";
import { poll } from "#Watcher/poll.ts";

export const Watcher = defineService({
	id: "@shivaedev/pr-watch/Watcher",
	initialize: initializeWatcher,
	methods: (state) => ({ delay, load, pacing, poll: genericMethod(poll(state)) }),
	requires: [GitHub, StateFile],
});
