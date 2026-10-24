import type { Boundary } from "#test/cloudRestart.ts";
import { host } from "#test/hostStory.ts";
import { configureInterruptedCloud } from "#test/interruptedCloud.ts";

export function interruptedCloudTrait(boundary: Boundary) {
	return host.trait("configuration", `Cloud loses its ${boundary} acknowledgement`, (engine) => {
		configureInterruptedCloud(engine, boundary);
	});
}
