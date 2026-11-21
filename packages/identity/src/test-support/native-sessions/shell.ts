import * as NodeWs from "@effect/platform-node/NodeWS";
import { createAuthClient } from "better-auth/client";
import { Deferred, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Socket from "effect/socket/Socket";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { sessionCredentialPlugin } from "#client/adapters/sessionCredentialPlugin.ts";
import { preferencesPlugin } from "#client/preferencesPlugin.ts";
import { SessionCredential, storedCredential } from "#client/SessionCredential.ts";
import { Api } from "#test/native-sessions/api.ts";
import { type Host, NATIVE_ORIGIN } from "#test/native-sessions/host.ts";
import { type ShellPreflight, webViewPreflight } from "#test/native-sessions/webViewPreflight.ts";

export interface HeldAnswer {
	readonly arrived: Deferred.Deferred<void>;
	readonly release: Deferred.Deferred<void>;
}

// The shell keeps its credential in memory where an application's Layer would reach OS secure storage.
export function memoryCredential() {
	const stored: { value: string | null } = { value: null };
	const layer = Layer.succeed(SessionCredential, {
		clear: Effect.sync(() => {
			stored.value = null;
		}),
		read: Effect.sync(() => stored.value),
		write: (value) =>
			Effect.sync(() => {
				stored.value = value;
			}),
	});
	return { layer, stored };
}

const webView = Layer.succeed(Socket.WebSocketConstructor, (url, protocols) => {
	if (protocols !== undefined && typeof protocols !== "string" && !Array.isArray(protocols)) {
		throw new Error("The WebView cannot set upgrade headers");
	}
	return new NodeWs.WebSocket(url, protocols, { origin: NATIVE_ORIGIN });
});

export function nativeShell(host: Host) {
	const credential = memoryCredential();
	const modes = new Set<string>();
	const network: { hold: HeldAnswer | undefined } = { hold: undefined };
	const preflights: ShellPreflight[] = [];
	async function shellFetch(input: string | URL | Request, init?: RequestInit) {
		modes.add(init?.credentials ?? "default");
		await webViewPreflight(preflights, NATIVE_ORIGIN, String(input), init);
		const response = await fetch(input, init);
		const hold = network.hold;
		if (hold !== undefined && new URL(String(input)).pathname.endsWith("/get-session")) {
			network.hold = undefined;
			await Effect.runPromise(Deferred.succeed(hold.arrived, undefined).pipe(Effect.andThen(Deferred.await(hold.release))));
		}
		return response;
	}
	const auth = createAuthClient({
		"baseURL": host.baseUrl,
		fetchOptions: { customFetchImpl: shellFetch, headers: { origin: NATIVE_ORIGIN } },
		plugins: [sessionCredentialPlugin(credential.layer), preferencesPlugin()],
	});
	// Each read connects a new client, as a new session generation does, so its socket reads the stored credential.
	const readOverSocket = Effect.fnUntraced(function* (owner: string) {
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(current) => Effect.sync(() => current.dispose()),
		);
		const made = makeClient(
			{ profiles: Api },
			{
				bearerToken: Effect.provide(storedCredential, credential.layer),
				registry,
				url: `${host.baseUrl}/rpc`,
				webSocketConstructor: webView,
			},
		);
		return yield* AtomRegistry.getResult(registry, made.runtime.atom(made.api.profiles.profile.run({ owner })).pipe(Atom.setIdleTTL(0)));
	});
	return { auth, credential, modes, network, preflights, readOverSocket };
}

export type NativeShell = ReturnType<typeof nativeShell>;
