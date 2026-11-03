import type { ServerResponse } from "node:http";
import * as Effect from "effect/Effect";
import { fakeHttpPause, fakeHttpSend } from "#server/adapters/fakeHttpSend.ts";
import type {
	FakeHttpFault,
	FakeHttpHoldOptions,
	FakeHttpReplySource,
	FakeHttpRequest,
	FakeHttpScope,
	FakeHttpScriptOptions,
} from "#server/fakeHttpService.ts";
import { fakeHttpGates } from "#server/internal/fakeHttpGates.ts";
import { fakeHttpScripts } from "#server/internal/fakeHttpScripts.ts";
import { fakeHttpSelection } from "#server/internal/fakeHttpSelection.ts";
import { describeValue } from "#server/internal/render.ts";
import { explained } from "#server/internal/wrap.ts";

export function fakeHttpControls(tell: (line: string) => void, now: () => number) {
	let failure: Error | undefined;
	const scripts = fakeHttpScripts(tell);
	const holds = fakeHttpGates(tell, "hold");
	const stalls = fakeHttpGates(tell, "stall");
	const arrivals = new Map<string, Set<() => void>>();
	const active = new Map<ServerResponse, { route: string; request: FakeHttpRequest }>();
	return {
		arrive: (route: string, request: FakeHttpRequest, response: ServerResponse) => {
			active.set(response, { request, route });
			response.once("close", () => active.delete(response));
			for (const release of arrivals.get(route) ?? []) {
				release();
			}
			arrivals.delete(route);
		},
		close: Effect.fnUntraced(function* () {
			for (const response of active.keys()) {
				response.destroy();
			}
			holds.close();
			stalls.close();
			arrivals.clear();
			scripts.clear();
			if (failure !== undefined) {
				yield* Effect.die(failure);
			}
		}),
		failed: (method: string, path: string, cause: unknown) => {
			const message = `fake HTTP could not answer ${method} ${path}: ${describeValue(cause)}`;
			tell(message);
			failure ??= new Error(explained(message, "Fix the fake's handler. To simulate an HTTP failure, return a reply with an error status."), {
				cause,
			});
		},
		fault: (route: string, fault: FakeHttpFault, scope?: FakeHttpScope): Effect.Effect<void> =>
			Effect.gen(function* () {
				const selection = fakeHttpSelection(route, scope);
				const found = [...active].find(
					([candidate, entry]) =>
						selection.matches(entry.route, entry.request)
						&& !(candidate.destroyed || candidate.writableEnded)
						&& candidate.headersSent === (fault.kind === "reset"),
				);
				if (!found) {
					return yield* Effect.die(
						new Error(
							`Fake HTTP route "${route}" has no request ready for a ${fault.kind} fault.\nhelp: Wait for a hold before a status or drop fault, or for response headers before a reset fault.`,
						),
					);
				}
				const [response, { request }] = found;
				tell(`fake HTTP ${selection.label} fault ${fault.kind}`);
				if (fault.kind === "status") {
					yield* Effect.promise(() => fakeHttpSend(response, typeof fault.reply === "function" ? fault.reply(request, now()) : fault.reply));
				} else {
					response.destroy();
				}
			}),
		hold: (route: string, options?: FakeHttpHoldOptions) => holds.make(route, options, options?.once),
		pause: (route: string, request: FakeHttpRequest, response: ServerResponse) => fakeHttpPause(response, () => holds.get(route, request)?.enter()),
		releaseOnArrival: (route: string, arrival: string, scope?: FakeHttpScope): Effect.Effect<void> =>
			Effect.gen(function* () {
				const hold = holds.at(route, scope);
				if (!hold) {
					return yield* Effect.die(
						new Error(`Fake HTTP route "${route}" has no hold.\nhelp: Hold the route before scripting its release on arrival.`),
					);
				}
				const releases = arrivals.get(arrival) ?? new Set<() => void>();
				releases.add(hold.release);
				arrivals.set(arrival, releases);
				tell(`fake HTTP ${route} will release when ${arrival} arrives`);
			}),
		reply: (source: FakeHttpReplySource, request: FakeHttpRequest) => (typeof source === "function" ? source(request, now()) : source),
		scriptFault: (route: string, fault: FakeHttpFault, options?: FakeHttpScriptOptions) => Effect.sync(() => scripts.make(route, fault, options)),
		stall: (route: string, scope?: FakeHttpScope) => stalls.make(route, scope),
		stallBody: (route: string, request: FakeHttpRequest) => {
			const stall = stalls.get(route, request);
			return stall ? () => stall.enter() : undefined;
		},
		takeFault: scripts.take,
	};
}
