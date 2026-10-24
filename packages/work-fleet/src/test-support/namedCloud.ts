import { configureCloudNaming } from "#test/cloudNaming.ts";
import { host } from "#test/hostStory.ts";

export function namedCloud(prefix?: string) {
	return host.trait("configuration", "Cloud sessions use readable Fleet thread names", (engine) => configureCloudNaming(engine, prefix));
}
