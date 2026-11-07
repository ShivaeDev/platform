import { Effect } from "effect";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { VitestRuntime } from "#VitestRuntime.ts";
import { open } from "#vitest-runner/open.ts";

export const VitestRunner = defineService({
	id: "@shivaedev/vitest-rerun/VitestRunner",
	initialize: Effect.void,
	methods: () => ({ open }),
	requires: [VitestRuntime],
});
