import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { Pots } from "./Pots.ts";
import { settlePot } from "./settlePot.ts";

export const PotLifecycle = defineService({
	id: "@shivaedev/sql/shared-pots/PotLifecycle",
	initialize: Effect.void,
	methods: () => ({ settlePot }),
	requires: [Pots],
});
