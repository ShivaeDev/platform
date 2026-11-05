import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { Pots } from "#test/diary/Pots.ts";
import { settlePot } from "./settle.ts";

export const PotLifecycle = defineService({
	id: "@shivaedev/sql/shared-pots/PotLifecycle",
	initialize: Effect.void,
	methods: () => ({ settlePot }),
	requires: [Pots],
});
