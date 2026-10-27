import { inviteHost } from "./invites.ts";
import { host } from "./story.ts";

export const inviteCommand = host.trait("configured", "the host issues invite codes with a startup-generated issuer", (state) => {
	state.build = () => inviteHost(state.config);
});
