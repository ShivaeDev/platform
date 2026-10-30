import type { ServerResponse } from "node:http";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import type {
	FakeHttpFault,
	FakeHttpHoldOptions,
	FakeHttpReplySource,
	FakeHttpRequest,
	FakeHttpScope,
	FakeHttpScriptOptions,
} from "#fakeHttpService.ts";
import { fakeHttpGates } from "#internal/fakeHttpGates.ts";
import { fakeHttpScripts } from "#internal/fakeHttpScripts.ts";
import { fakeHttpSelection } from "#internal/fakeHttpSelection.ts";
import { fakeHttpConnection, fakeHttpSend } from "#internal/fakeHttpSend.ts";
import { describeValue } from "#internal/render.ts";
import { explained } from "#internal/wrap.ts";

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
		fault: (route: string, fault: FakeHttpFault, scope?: FakeHttpScope) =>
			Effect.promise(async () => {
				const selection = fakeHttpSelection(route, scope);
				const found = [...active].find(
					([candidate, entry]) =>
						selection.matches(entry.route, entry.request)
						&& !(candidate.destroyed || candidate.writableEnded)
						&& candidate.headersSent === (fault.kind === "reset"),
				);
				if (!found) {
					throw new Error(
						`Fake HTTP route "${route}" has no request ready for a ${fault.kind} fault.\nhelp: Wait for a hold before a status or drop fault, or for response headers before a reset fault.`,
					);
				}
				const [response, { request }] = found;
				tell(`fake HTTP ${selection.label} fault ${fault.kind}`);
				if (fault.kind === "status") {
					await fakeHttpSend(response, typeof fault.reply === "function" ? fault.reply(request, now()) : fault.reply);
				} else {
					response.destroy();
				}
			}),
		hold: (route: string, options?: FakeHttpHoldOptions) => Effect.sync(() => holds.make(route, options, options?.once)),
		pause: async (route: string, request: FakeHttpRequest, response: ServerResponse) => {
			await fakeHttpConnection(response).pause(holds.get(route, request)?.enter());
			return !(response.destroyed || response.writableEnded || response.headersSent);
		},
		queue: (route: string, reply: FakeHttpReplySource, scope?: FakeHttpScope) =>
			Effect.sync(() => {
				scripts.make(route, { kind: "status", reply }, scope, false);
				tell(
					`fake HTTP ${fakeHttpSelection(route, scope).label} will answer once with ${typeof reply === "function" ? "a request-time reply" : (reply.status ?? HttpStatus.fromLiteral("OK"))}`,
				);
			}),
		releaseOnArrival: (route: string, arrival: string, scope?: FakeHttpScope) =>
			Effect.sync(() => {
				const hold = holds.at(route, scope);
				if (!hold) {
					throw new Error(`Fake HTTP route "${route}" has no hold.\nhelp: Hold the route before scripting its release on arrival.`);
				}
				const releases = arrivals.get(arrival) ?? new Set<() => void>();
				releases.add(hold.release);
				arrivals.set(arrival, releases);
				tell(`fake HTTP ${route} will release when ${arrival} arrives`);
			}),
		reply: (source: FakeHttpReplySource, request: FakeHttpRequest) => (typeof source === "function" ? source(request, now()) : source),
		scriptFault: (route: string, fault: FakeHttpFault, options?: FakeHttpScriptOptions) => Effect.sync(() => scripts.make(route, fault, options)),
		stall: (route: string, scope?: FakeHttpScope) => Effect.sync(() => stalls.make(route, scope)),
		stallBody: (route: string, request: FakeHttpRequest) => {
			const stall = stalls.get(route, request);
			return stall ? () => stall.enter() : undefined;
		},
		takeFault: scripts.take,
	};
}
