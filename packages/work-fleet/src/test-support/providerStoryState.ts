import { type Clock, Queue, type Scope } from "effect";
import type { CodexCloudConfiguration } from "#providers/codexCloud.ts";
import type { SessionTransport } from "#session/service.ts";
import type { Handshake, WireRequest } from "#test/codex.ts";
import { FUTURE_EXPIRY, syntheticToken } from "#test/codexCloud.ts";
export interface ProviderState {
	allowConnectionFailure: boolean;
	clock: Clock.Clock | undefined;
	cloud: boolean;
	failure: import("#session/schema.ts").SessionFailure | undefined;
	handshakes: Handshake[];
	localTimeout: number;
	observerScope: Scope.Closeable | undefined;
	options: Partial<CodexCloudConfiguration>;
	refreshToken: string | undefined;
	reply: (request: WireRequest) => unknown;
	requests: WireRequest[];
	sleeps: Queue.Queue<number>;
	token: string;
	transport: typeof SessionTransport.Service | undefined;
}
export function* newProvider() {
	const state: ProviderState = {
		allowConnectionFailure: false,
		clock: undefined,
		cloud: false,
		failure: undefined,
		handshakes: [],
		localTimeout: 1000,
		observerScope: undefined,
		options: {},
		refreshToken: undefined,
		reply: (_request: WireRequest): unknown => ({}),
		requests: [],
		sleeps: yield* Queue.unbounded<number>(),
		token: syntheticToken("current", FUTURE_EXPIRY),
		transport: undefined,
	};
	return state;
}
