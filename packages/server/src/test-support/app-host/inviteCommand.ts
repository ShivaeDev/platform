import { inviteHost } from "#test/app-host/invites.ts";
import { host } from "#test/app-host/story.ts";

export const inviteCommand = host.trait("configured", "the host issues invite codes with a startup-generated issuer", (state) => {
	state.build = () => inviteHost(state.config);
});
