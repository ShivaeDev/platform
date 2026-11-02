import { Effect, Schema } from "effect";
import { forkHost, type HostProcessOptions, hostResponse, receiveHostMessage, stopHost } from "#testing/adapters/hostProcess.ts";
import { HostProcessError } from "./HostProcessError.ts";
import { HostReady, HostSignal } from "./hostProcessProtocol.ts";

export const hostProcess = Effect.fn("HostProcess.hostProcess")(function* (options: HostProcessOptions) {
	const child = yield* Effect.acquireRelease(
		Effect.try({ catch: (cause) => new HostProcessError({ cause, operation: "launch" }), try: () => forkHost(options) }),
		(acquired) => Effect.promise(() => stopHost(acquired)),
	);
	const { pid, url } = yield* Effect.tryPromise({
		catch: (cause) => new HostProcessError({ cause, operation: "launch" }),
		try: (signal) => receiveHostMessage(child, HostReady, signal),
	});
	function response(path: string) {
		return Effect.tryPromise({
			catch: (cause) => new HostProcessError({ cause, operation: "request" }),
			try: (signal) => hostResponse(url, path, signal),
		});
	}
	return {
		headers: (path: string) => response(path).pipe(Effect.map((answer) => answer.headers)),
		health: () => response("/health"),
		pid,
		signal: (delivered: NodeJS.Signals) =>
			Effect.tryPromise({
				catch: (cause) => new HostProcessError({ cause, operation: "signal" }),
				try: (signal) =>
					receiveHostMessage(child, HostSignal.pipe(Schema.check(Schema.makeFilter((ack) => ack.signal === delivered))), signal, () => {
						child.kill(delivered);
					}),
			}).pipe(Effect.asVoid),
		stop: () => Effect.promise(() => stopHost(child)),
		url,
	};
});
