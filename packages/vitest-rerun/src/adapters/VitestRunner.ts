import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { open } from "./open.ts";

export interface Selection {
	readonly fileId: string;
	readonly testIds?: string[];
}

export const VitestRunner = defineService({
	id: "@shivaedev/vitest-rerun/VitestRunner",
	initialize: Effect.void,
	methods: () => ({ open }),
	requires: [],
});

export type AttemptRunner = Effect.Success<ReturnType<typeof open>>;
