import { expect } from "vitest";
import { hostConfigured, publicConfigStory } from "#test/public-config/story.ts";

publicConfigStory.it(
	"a screen reading public configuration from a platform host links to the configured install URL",
	[hostConfigured({ "INSTALL_URL": "https://example.com/install", "SERVER_SECRET": "private-server-key" })],
	function* ({ installLink, open }) {
		yield* open();

		expect(yield* installLink()).toEqual({ href: "https://example.com/install", text: "Install application" });
	},
);
