import process from "node:process";
import { Effect } from "effect";
import { HttpServer } from "effect/http";
import { sendHostMessage } from "#testing/adapters/hostProcess.ts";
import { HostProcessError } from "./HostProcessError.ts";

export const reportHostReady = HttpServer.HttpServer.pipe(
	Effect.flatMap((server) =>
		Effect.tryPromise({
			catch: (cause) => new HostProcessError({ cause, operation: "launch" }),
			try: () => sendHostMessage({ pid: process.pid, type: "host-ready", url: HttpServer.formatAddress(server.address) }),
		}),
	),
);

export function acknowledgeHostSignal(signal: NodeJS.Signals) {
	return Effect.tryPromise({
		catch: (cause) => new HostProcessError({ cause, operation: "signal" }),
		try: () => sendHostMessage({ signal, type: "host-signal" }),
	});
}
