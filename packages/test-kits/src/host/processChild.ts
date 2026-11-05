import { Effect } from "effect";
import { HttpServer } from "effect/http";
import { sendHostMessage, sendHostReady, waitForHostStart } from "#host/adapters/process.ts";
import { HostProcessError } from "#host/ProcessError.ts";

export const awaitHostStart = Effect.tryPromise({
	catch: (cause) => new HostProcessError({ cause, operation: "launch" }),
	try: waitForHostStart,
});

export const reportHostReady = HttpServer.HttpServer.pipe(
	Effect.flatMap((server) =>
		Effect.tryPromise({
			catch: (cause) => new HostProcessError({ cause, operation: "launch" }),
			try: () => sendHostReady(HttpServer.formatAddress(server.address)),
		}),
	),
);

export function acknowledgeHostSignal(signal: NodeJS.Signals) {
	return Effect.tryPromise({
		catch: (cause) => new HostProcessError({ cause, operation: "signal" }),
		try: () => sendHostMessage({ signal, type: "host-signal" }),
	});
}
