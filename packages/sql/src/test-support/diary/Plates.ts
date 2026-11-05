import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { addPortion } from "./addPortion.ts";
import { loadPot } from "./loadPot.ts";
import { Pots } from "./Pots.ts";

export const Plates = defineService({
	id: "@shivaedev/sql/shared-pots/Plates",
	initialize: Effect.void,
	methods: () => ({ addPortion, loadPot }),
	requires: [Pots],
});
