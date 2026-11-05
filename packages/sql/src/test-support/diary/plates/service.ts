import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { Pots } from "#test/diary/Pots.ts";
import { addPortion } from "./addPortion.ts";
import { loadPot } from "./loadPot.ts";

export const Plates = defineService({
	id: "@shivaedev/sql/shared-pots/Plates",
	initialize: Effect.void,
	methods: () => ({ addPortion, loadPot }),
	requires: [Pots],
});
