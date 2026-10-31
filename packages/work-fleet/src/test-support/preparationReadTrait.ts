import { host } from "#test/hostStory.ts";
import { configurePreparationRead } from "#test/preparationRead.ts";

export function preparationReadTrait() {
	return host.trait("configuration", "the first preparation's main snapshot is held", configurePreparationRead);
}
