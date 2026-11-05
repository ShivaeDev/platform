import { defineRepository } from "#defineRepository.ts";
import { initializePots } from "./initializePots.ts";

export const Pots = defineRepository({
	id: "@shivaedev/sql/shared-pots/Pots",
	initialize: initializePots,
});
