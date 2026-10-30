import { host } from "#test/hostStory.ts";
import { configureRestartCloud, type RestartBoundary } from "#test/restartCloud.ts";

export function restartCloudTrait(boundary: RestartBoundary) {
	return host.trait("configuration", `Cloud can pause at ${boundary} with unpublished work and no attachments`, (engine) =>
		configureRestartCloud(engine, boundary),
	);
}
