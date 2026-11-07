import { Effect } from "effect";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { Pots } from "#test/diary/Pots.ts";
import { settlePot } from "#test/diary/pot-lifecycle/settle.ts";

export const PotLifecycle = defineService({
	id: "@shivaedev/sql/shared-pots/PotLifecycle",
	initialize: Effect.void,
	methods: () => ({ settlePot }),
	requires: [Pots],
});
