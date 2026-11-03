import { boardStory } from "./boardStory.ts";
import { pageTrafficScripts } from "./pageSettle.ts";

export function pageTraffic() {
	return boardStory.trait("project", "the reader's page records the RPC requests it sends and the answers it receives", (engine) => {
		engine.beforeScripts = pageTrafficScripts(engine, engine.beforeScripts);
	});
}
