import { expect } from "vitest";
import { assetDocument } from "#test/assetDocument.ts";

assetDocument.it(
	"loads a page without fetching or warning about disabled external assets",
	[],
	function* ({ heading, loadPage, loggedErrors, receivedRequests, settle }) {
		yield* loadPage();
		yield* settle();
		expect(heading()).toBe("Page with external assets");
		expect(loggedErrors()).toEqual([]);
		expect(receivedRequests()).toEqual(["GET /page"]);
	},
);
