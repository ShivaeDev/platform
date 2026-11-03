import "#server/browserReads.ts";
import "#client/react.ts";
import "#server/memberScreens.ts";
import "#server/otlpReceiver.ts";
import "#server/seedCookies.ts";
import { storyKit } from "#server/storyKit.ts";

const integrations = storyKit({
	create: () => ({}),
	name: "integrations",
	stages: [],
	verbs: () => ({}),
});

integrations.it("collects unused integrations", []);
