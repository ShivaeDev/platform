import { Effect, FileSystem } from "effect";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { load } from "#state-file/load.ts";
import { save } from "#state-file/save.ts";

export const StateFile = defineService({
	id: "@shivaedev/pr-watch/StateFile",
	initialize: Effect.void,
	methods: () => ({ load, save }),
	requires: [FileSystem.FileSystem],
});
