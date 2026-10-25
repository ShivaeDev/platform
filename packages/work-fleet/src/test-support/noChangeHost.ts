import { engineIntegrations } from "#test/engineIntegrations.ts";
import { host } from "#test/hostStory.ts";

export const noChangeHost = host.trait("configuration", "the worker proves no source change is needed", (engine) => {
	engine.integrations = engineIntegrations({}, []);
});
