import type { IncomingHttpHeaders } from "node:http";
import * as Effect from "effect/Effect";
import { fakeHttpRuntime } from "#server/adapters/fakeHttpRuntime.ts";
import { type UntilOptions, until } from "#server/until.ts";

export interface FakeHttpRequest {
	readonly body: Buffer;
	readonly headers: IncomingHttpHeaders;
	readonly method: string;
	readonly params: Readonly<Record<string, string>>;
	readonly path: string;
	readonly query: URLSearchParams;
}

export interface FakeHttpReply {
	readonly body?: unknown;
	readonly chunks?: Iterable<string | Uint8Array> | AsyncIterable<string | Uint8Array>;
	readonly headers?: Readonly<Record<string, string>>;
	readonly status?: number;
}

export type FakeHttpReplySource = FakeHttpReply | ((request: FakeHttpRequest, now: number) => FakeHttpReply);

export interface FakeHttpRequestRecord extends FakeHttpRequest {
	readonly status: number | "pending" | "unanswered";
}

export type FakeHttpFault = { readonly kind: "status"; readonly reply: FakeHttpReplySource } | { readonly kind: "drop" | "reset" };

export interface FakeHttpScope {
	readonly params?: Readonly<Record<string, string>>;
}

export interface FakeHttpHoldOptions extends FakeHttpScope {
	readonly once?: boolean;
}

export interface FakeHttpScriptOptions extends FakeHttpScope {
	readonly phase?: "before" | "after";
	readonly repeat?: boolean;
}

export interface FakeHttpScript {
	readonly lift: Effect.Effect<void>;
}

export type FakeHttpRoute = {
	readonly guard?: (request: FakeHttpRequest) => boolean;
	readonly method?: string;
	readonly path: string;
} & (
	| { readonly reply: (request: FakeHttpRequest) => FakeHttpReply; readonly pages?: never }
	| { readonly pages: readonly (readonly unknown[])[]; readonly reply?: never }
);

export interface FakeHttpServiceOptions {
	readonly guard?: (request: FakeHttpRequest) => boolean;
	readonly routes: Readonly<Record<string, FakeHttpRoute>>;
	readonly tell?: (line: string) => void;
}

export interface FakeHttpHold {
	readonly release: Effect.Effect<void>;
	readonly waiting: Effect.Effect<void>;
}

export const fakeHttpService = Effect.fnUntraced(function* (options: FakeHttpServiceOptions) {
	let narrate = options.tell;
	function tell(line: string) {
		narrate?.(line);
	}
	const { controls, signals, requests, url } = yield* fakeHttpRuntime(options, tell);
	const checkRoute = Effect.fnUntraced(function* (route: string) {
		if (!Object.hasOwn(options.routes, route)) {
			return yield* Effect.die(
				new Error(`Unknown fake HTTP route "${route}".\nhelp: Use a name from fakeHttpService's routes when scripting a reply or hold.`),
			);
		}
	});
	return {
		completed: signals.completed,
		fault: (route: string, fault: FakeHttpFault, scope?: FakeHttpScope) =>
			checkRoute(route).pipe(Effect.andThen(controls.fault(route, fault, scope))),
		hold: (route: string, holdOptions?: FakeHttpHoldOptions) => checkRoute(route).pipe(Effect.andThen(controls.hold(route, holdOptions))),
		narrate: (sink: (line: string) => void) => {
			narrate = sink;
		},
		received: signals.received,
		releaseOnArrival: (route: string, arrival: string, scope?: FakeHttpScope) =>
			Effect.gen(function* () {
				yield* checkRoute(route);
				yield* checkRoute(arrival);
			}).pipe(Effect.andThen(controls.releaseOnArrival(route, arrival, scope))),
		get requests(): readonly FakeHttpRequestRecord[] {
			return requests.slice();
		},
		scriptFault: (route: string, fault: FakeHttpFault, scriptOptions?: FakeHttpScriptOptions) =>
			checkRoute(route).pipe(Effect.andThen(controls.scriptFault(route, fault, scriptOptions))),
		stall: (route: string, scope?: FakeHttpScope) => checkRoute(route).pipe(Effect.andThen(controls.stall(route, scope))),
		untilAbandoned: (matches: (request: FakeHttpRequestRecord) => boolean, wait: UntilOptions) => until(signals.abandoned, matches, wait),
		url,
	};
});
