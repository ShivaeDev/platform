import type { ServerResponse } from "node:http";
import { Effect } from "effect";
import type { FakeHttpFault, FakeHttpReply } from "#fakeHttpService.ts";
import { fakeHttpGates } from "#internal/fakeHttpGates.ts";
import { fakeHttpConnection, fakeHttpSend } from "#internal/fakeHttpSend.ts";

export function fakeHttpControls(tell: (line: string) => void) {
	const replies = new Map<string, FakeHttpReply[]>();
	const holds = fakeHttpGates(tell, "hold");
	const stalls = fakeHttpGates(tell, "stall");
	const arrivals = new Map<string, Set<() => void>>();
	const active = new Map<ServerResponse, string>();
	return {
		arrive: (route: string, response: ServerResponse) => {
			active.set(response, route);
			response.once("close", () => active.delete(response));
			for (const release of arrivals.get(route) ?? []) {
				release();
			}
			arrivals.delete(route);
		},
		close: () => {
			for (const response of active.keys()) {
				response.destroy();
			}
			holds.close();
			stalls.close();
			arrivals.clear();
			replies.clear();
		},
		fault: (route: string, fault: FakeHttpFault) =>
			Effect.promise(async () => {
				const response = [...active].find(
					([candidate, name]) =>
						name === route && !(candidate.destroyed || candidate.writableEnded) && candidate.headersSent === (fault.kind === "reset"),
				)?.[0];
				if (!response) {
					throw new Error(
						`Fake HTTP route "${route}" has no request ready for a ${fault.kind} fault.\nhelp: Wait for a hold before a status or drop fault, or for response headers before a reset fault.`,
					);
				}
				tell(`fake HTTP ${route} fault ${fault.kind}`);
				if (fault.kind === "status") {
					await fakeHttpSend(response, fault.reply);
				} else {
					response.destroy();
				}
			}),
		hold: (route: string) => Effect.sync(() => holds.make(route)),
		pause: async (route: string, response: ServerResponse) => {
			await fakeHttpConnection(response).pause(holds.get(route)?.enter());
			return !(response.destroyed || response.writableEnded || response.headersSent);
		},
		queue: (route: string, reply: FakeHttpReply) =>
			Effect.sync(() => {
				const queue = replies.get(route) ?? [];
				queue.push(reply);
				replies.set(route, queue);
				tell(`fake HTTP ${route} will answer once with ${reply.status ?? 200}`);
			}),
		releaseOnArrival: (route: string, arrival: string) =>
			Effect.sync(() => {
				const hold = holds.get(route);
				if (!hold) {
					throw new Error(`Fake HTTP route "${route}" has no hold.\nhelp: Hold the route before scripting its release on arrival.`);
				}
				const releases = arrivals.get(arrival) ?? new Set<() => void>();
				releases.add(hold.release);
				arrivals.set(arrival, releases);
				tell(`fake HTTP ${route} will release when ${arrival} arrives`);
			}),
		stall: (route: string) => Effect.sync(() => stalls.make(route)),
		stallBody: (route: string) => {
			const stall = stalls.get(route);
			return stall ? () => stall.enter() : undefined;
		},
		takeReply: (route: string) => replies.get(route)?.shift(),
	};
}
