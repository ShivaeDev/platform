import { defineRepository } from "#defineRepository.ts";
import { initializePots } from "#test/diary/initializePots.ts";

export const Pots = defineRepository({
	id: "@shivaedev/sql/shared-pots/Pots",
	initialize: initializePots,
});
