import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { GitHub } from "#github/service.ts";
import { StateFile } from "#state-file/service.ts";
import { delay } from "#watcher/delay.ts";
import { load } from "#watcher/load.ts";
import { observe } from "#watcher/observe.ts";
import { pacing } from "#watcher/pacing.ts";
import { save } from "#watcher/save.ts";
import { targets } from "#watcher/targets.ts";

export const Watcher = defineService({
	id: "@shivaedev/pr-watch/Watcher",
	initialize: Effect.void,
	methods: () => ({ delay, load, observe, pacing, save, targets }),
	requires: [GitHub, StateFile],
});
