import { Stream } from "effect";
import { HostVersion } from "@shivaedev/contract/HostVersion.ts";

export function hostVersionLayer(version: string | undefined) {
	return HostVersion.application.toLayer({
		"platform.hostVersion.watch": () => (version === undefined ? Stream.never : Stream.concat(Stream.succeed(version), Stream.never)),
	});
}
