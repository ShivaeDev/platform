import { Effect } from "effect";
import { dispatchApproved } from "#host/admission.ts";
import { type HostParts, hostLayer } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";

export function dispatchWork(host: FleetHost, workId: string, parts: HostParts) {
	return dispatchApproved(host, workId).pipe(Effect.provide(hostLayer(host, parts)));
}
