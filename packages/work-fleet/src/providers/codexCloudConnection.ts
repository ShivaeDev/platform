import { Effect, Exit, type FileSystem, Redacted, Scope, Semaphore } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import { type CodexLogin, codexAccessToken } from "#providers/codexLogin.ts";
import { type CodexConnection, connect, failure, initialize, request } from "#providers/codexRpc.ts";

function cloudUrl(endpoint: string) {
	return Effect.try({ catch: () => failure("unavailable", "Invalid Codex Cloud endpoint"), try: () => new URL(endpoint) }).pipe(
		Effect.filterOrFail(
			(url) => url.protocol === "wss:" || (url.protocol === "ws:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)),
			() => failure("unavailable", "Codex Cloud bearer authentication requires a wss endpoint"),
		),
	);
}
// Connections reopen with a fresh login; a dropped socket fails in-flight mutations as ambiguous.
export const codexCloudConnection = Effect.fn("CodexCloud.codexCloudConnection")(function* (endpoint: string, login: CodexLogin, timeoutMs: number) {
	const url = yield* cloudUrl(endpoint);
	const services = yield* Effect.context<FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner>();
	const layerScope = yield* Effect.scope;
	const lock = yield* Semaphore.make(1);
	let current: { readonly connection: CodexConnection; readonly scope: Scope.Closeable } | undefined;
	const open = Effect.gen(function* () {
		if (current !== undefined) {
			yield* Scope.close(current.scope, Exit.void);
			current = undefined;
		}
		const token = yield* codexAccessToken(login, timeoutMs).pipe(Effect.provide(services));
		const scope = yield* Scope.fork(layerScope);
		const connection = yield* Effect.gen(function* () {
			const opened = yield* connect(
				{ protocols: ["codex-app-server", `codex-client.${crypto.randomUUID()}`, `openai-bearer.${Redacted.value(token)}`], url },
				timeoutMs,
			);
			yield* initialize(opened, timeoutMs, true);
			return opened;
		}).pipe(
			Scope.provide(scope),
			Effect.onError(() => Scope.close(scope, Exit.void)),
		);
		current = { connection, scope };
		return connection;
	});
	const connection = Semaphore.withPermits(
		lock,
		1,
	)(Effect.suspend(() => (current !== undefined && !current.connection.closed.value ? Effect.succeed(current.connection) : open)));
	return function rpc(method: string, params: unknown, mutation = false) {
		return connection.pipe(Effect.flatMap((opened) => request(opened, timeoutMs, method, params, mutation)));
	};
});
