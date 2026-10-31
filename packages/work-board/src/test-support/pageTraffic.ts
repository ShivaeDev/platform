import { boardStory } from "./boardStory.ts";
import { pageTrafficScripts } from "./pageSignals.ts";

export function pageTraffic() {
	return boardStory.trait("project", "the reader's page records the RPC requests it sends and the answers it receives", (engine) => {
		engine.beforeScripts = pageTrafficScripts(engine, engine.beforeScripts);
	});
}
