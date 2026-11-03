import type { ChildProcess } from "node:child_process";
import process from "node:process";
import { Option, Predicate, Schema } from "effect";
import { HostReadouts } from "#testing/hostProcessProtocol.ts";
import { receiveHostMessage } from "./hostProcess.ts";

export function listenHostReadouts(read: () => typeof HostReadouts.Type) {
	function requested(message: unknown) {
		if (Predicate.hasProperty(message, "type") && message.type === "host-readouts") {
			process.send?.(read());
		}
	}
	process.on("message", requested);
	return () => process.off("message", requested);
}

export function collectHostReadouts(child: ChildProcess) {
	let completed: typeof HostReadouts.Type | undefined;
	child.on("message", (message: unknown) => {
		const decoded = Schema.decodeUnknownOption(HostReadouts)(message);
		if (Option.isSome(decoded) && decoded.value.shutdownDuration !== null) {
			completed = decoded.value;
		}
	});
	return (signal: AbortSignal) =>
		completed === undefined
			? receiveHostMessage(child, HostReadouts, signal, () => child.send({ type: "host-readouts" }))
			: Promise.resolve(completed);
}
