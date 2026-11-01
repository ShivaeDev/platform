import "#browserReads.ts";
import "#client/react.ts";
import "#memberScreens.ts";
import "#otlpReceiver.ts";
import "#seedCookies.ts";
import { storyKit } from "#storyKit.ts";

const integrations = storyKit({
	create: () => ({}),
	name: "integrations",
	stages: [],
	verbs: () => ({}),
});

integrations.it("collects unused integrations", []);
