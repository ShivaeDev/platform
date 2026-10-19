import { createServer, type IncomingHttpHeaders } from "node:http";
import { Effect } from "effect";
import { fakeHttpControls } from "#internal/fakeHttpControls.ts";
import { fakeHttpReceive } from "#internal/fakeHttpReceive.ts";
import { loopbackServer } from "#internal/loopback.ts";

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

export type FakeHttpFault = { readonly kind: "status"; readonly reply: FakeHttpReply } | { readonly kind: "drop" | "reset" };

export type FakeHttpRoute = {
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
	const requests: FakeHttpRequest[] = [];
	let narrate = options.tell;
	function tell(line: string) {
		narrate?.(line);
	}
	const controls = fakeHttpControls(tell);
	const server = createServer((request, response) => fakeHttpReceive(request, response, options, requests, controls, tell));
	const url = yield* loopbackServer(server);
	yield* Effect.addFinalizer(() => Effect.sync(controls.close));
	function checkRoute(route: string) {
		if (!Object.hasOwn(options.routes, route)) {
			throw new Error(`Unknown fake HTTP route "${route}".\nhelp: Use a name from fakeHttpService's routes when scripting a reply or hold.`);
		}
	}
	return {
		failOnce: (route: string, reply: FakeHttpReply) => Effect.sync(() => checkRoute(route)).pipe(Effect.andThen(controls.queue(route, reply))),
		fault: (route: string, fault: FakeHttpFault) => Effect.sync(() => checkRoute(route)).pipe(Effect.andThen(controls.fault(route, fault))),
		hold: (route: string) => Effect.sync(() => checkRoute(route)).pipe(Effect.andThen(controls.hold(route))),
		narrate: (sink: (line: string) => void) => {
			narrate = sink;
		},
		releaseOnArrival: (route: string, arrival: string) =>
			Effect.sync(() => {
				checkRoute(route);
				checkRoute(arrival);
			}).pipe(Effect.andThen(controls.releaseOnArrival(route, arrival))),
		replyOnce: (route: string, reply: FakeHttpReply) => Effect.sync(() => checkRoute(route)).pipe(Effect.andThen(controls.queue(route, reply))),
		get requests(): readonly FakeHttpRequest[] {
			return requests.slice();
		},
		stall: (route: string) => Effect.sync(() => checkRoute(route)).pipe(Effect.andThen(controls.stall(route))),
		url,
	};
});
