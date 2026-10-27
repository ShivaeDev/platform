import { Layer } from "effect";
import { appHost } from "#appHost.ts";
import { Ping, pingHandlers } from "./ping.ts";
import { host } from "./story.ts";

export function nativeOriginList(nativeOrigins: readonly string[]) {
	return host.trait("configured", "the host lists exact native origins", (state) => {
		state.build = () =>
			appHost({ config: state.config, group: Ping, handlers: pingHandlers, nativeOrigins, policy: "loopback", services: Layer.empty });
	});
}
