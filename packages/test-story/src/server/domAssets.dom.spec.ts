import { outcomes } from "#outcomes.ts";
import { assetDocument } from "#test/assetDocument.ts";

assetDocument.it(
	"loads a page without fetching or warning about its disabled external assets",
	[],
	function* ({ loadsPage, heading, loggedErrors, receivedRequests }) {
		yield* loadsPage();

		yield* outcomes({
			"the heading": [heading(), "Page with external assets"],
			"the host's requests": [receivedRequests(), ["GET /page"]],
			"the logged errors": [loggedErrors(), []],
		});
	},
);
