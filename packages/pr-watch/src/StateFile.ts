import { Effect, FileSystem } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { save } from "#StateFile/adapters/save.ts";
import { load } from "#StateFile/load.ts";

export const StateFile = defineService({
	id: "@shivaedev/pr-watch/StateFile",
	initialize: Effect.void,
	methods: () => ({ load, save }),
	requires: [FileSystem.FileSystem],
});
