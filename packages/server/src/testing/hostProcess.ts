import { Effect, Redacted, Schema } from "effect";
import { forkHost, type HostProcessOptions, hostResponse, receiveHostMessage, stopHost } from "#testing/adapters/hostProcess.ts";
import { collectHostReadouts } from "#testing/adapters/hostProcessReadouts.ts";
import { HostProcessError } from "./HostProcessError.ts";
import { HostReady, HostSignal } from "./hostProcessProtocol.ts";

export const hostProcess = Effect.fn("HostProcess.hostProcess")(function* (options: HostProcessOptions) {
	const databaseUrl = options.databaseUrl;
	const database =
		databaseUrl === undefined
			? undefined
			: yield* Effect.promise(() => import("@shivaedev/test-sql/server/disconnectProxy.ts")).pipe(
					Effect.flatMap(({ disconnectProxy }) => disconnectProxy(Redacted.value(databaseUrl))),
				);
	const child = yield* Effect.acquireRelease(
		Effect.try({ catch: (cause) => new HostProcessError({ cause, operation: "launch" }), try: () => forkHost(options, database?.url) }),
		(acquired) => Effect.promise(() => stopHost(acquired)),
	);
	const read = collectHostReadouts(child);
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
	function readouts() {
		return Effect.tryPromise({
			catch: (cause) => new HostProcessError({ cause, operation: "readout" }),
			try: read,
		});
	}
	return {
		activeWork: () => readouts().pipe(Effect.map((state) => state.activeWork)),
		disconnectIdlePostgres: () =>
			Effect.suspend(() =>
				database === undefined
					? Effect.die(new Error("Launch the host with databaseUrl before disconnecting PostgreSQL"))
					: Effect.sync(database.disconnect),
			),
		finalizers: () => readouts().pipe(Effect.map((state) => state.finalizers)),
		headers: (path: string) => response(path).pipe(Effect.map((answer) => answer.headers)),
		health: () => response("/health"),
		pid,
		shutdownDuration: () => readouts().pipe(Effect.map((state) => state.shutdownDuration)),
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
