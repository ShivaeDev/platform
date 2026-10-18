import { expect } from "vitest";
import { publicConfigStory } from "#test/public-config/story.ts";

publicConfigStory.it("useQuery renders public configuration from a real platform HTTP host", [], function* ({ serve, open, view, observe }) {
	yield* serve({ "INSTALL_URL": "https://example.com/install", "SERVER_SECRET": "private-server-key" });
	yield* open();
	yield* observe("the install link receives the decoded public URL", () => {
		const link = view().querySelector("a");
		expect(link?.href).toBe("https://example.com/install");
		expect(link?.textContent).toBe("Install application");
	});
});
