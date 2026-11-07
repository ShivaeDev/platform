import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { Pots } from "#test/diary/Pots.ts";
import { addPortion } from "#test/diary/plates/addPortion.ts";
import { loadPot } from "#test/diary/plates/loadPot.ts";

export const Plates = defineService({
	id: "@shivaedev/sql/shared-pots/Plates",
	initialize: Effect.void,
	methods: () => ({ addPortion, loadPot }),
	requires: [Pots],
});
