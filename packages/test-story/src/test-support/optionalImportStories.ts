import "#server/browserReads.ts";
import "#client/adapters/react.ts";
import "#server/adapters/memberScreens.ts";
import "#server/otlpReceiver.ts";
import "#server/adapters/seedCookies.ts";
import { storyKit } from "#server/storyKit.ts";

const integrations = storyKit({
	create: () => ({}),
	name: "integrations",
	stages: [],
	verbs: () => ({}),
});

integrations.it("collects unused integrations", []);
