import { DateTime, Effect, Fiber, Option, Queue, Stream } from "effect";
import { answered, decodedErrorWords } from "@shivaedev/test/answers.ts";
import type { SessionList, SessionListInput } from "#sessions.ts";
import { type Accounts, type Actor, type Device, deviceOf, headersOf, personOf } from "./fixtures.ts";
import type { SessionAdminHost } from "./host.ts";

export function sessionAdminVerbs(engine: { accounts: Accounts; host: SessionAdminHost }, story: { tell: (line: string) => void }) {
	const { accounts, host } = engine;
	let page: typeof SessionList.Type | undefined;
	let listAnswer: string | undefined;
	let revokeAnswer: string | undefined;
	let subscription: Effect.Effect<unknown> | undefined;
	return {
		followProfile: Effect.fnUntraced(function* (actor: Device) {
			story.tell(`${actor} opens a live profile subscription`);
			const received = yield* Queue.unbounded<unknown>();
			const fiber = yield* host.client(headersOf(accounts, actor)).pipe(
				Effect.flatMap((rpc) =>
					Stream.runForEach(rpc["profile.$changes"]({ queries: [{ payload: undefined, query: "read" }] }), (hint) => Queue.offer(received, hint)),
				),
				Effect.scoped,
				answered,
				Effect.forkScoped,
			);
			subscription = Fiber.join(fiber);
			return yield* Effect.raceFirst(Queue.take(received).pipe(Effect.as("following")), Fiber.join(fiber));
		}),
		hasNextPage: () =>
			Effect.sync(() => {
				if (page === undefined) {
					throw new Error("No sessions page was received");
				}
				return Option.isSome(page.next);
			}),
		list: Effect.fnUntraced(function* (input: typeof SessionListInput.Type = { limit: 100 }, actor: Actor = "alice") {
			story.tell(`${actor} requests a sessions page${input.cursor === undefined ? "" : ` after ${deviceOf(accounts, input.cursor.id)}`}`);
			page = undefined;
			listAnswer = undefined;
			const result = yield* host.client(headersOf(accounts, actor)).pipe(
				Effect.flatMap((rpc) => rpc["identity.sessions.list"](input)),
				Effect.scoped,
				answered,
			);
			if (typeof result === "string") {
				listAnswer = result;
			} else {
				page = result;
			}
		}),
		listAnswer: () => Effect.sync(() => listAnswer ?? "listed"),
		listedDevices: () =>
			Effect.sync(() => {
				if (page === undefined) {
					throw new Error("No sessions page was received");
				}
				return page.sessions.map(({ id }) => deviceOf(accounts, id));
			}),
		listedSessions: () =>
			Effect.sync(() => {
				if (page === undefined) {
					throw new Error("No sessions page was received");
				}
				return page.sessions.map((session) => ({
					...session,
					expiresAt: DateTime.formatIso(session.expiresAt),
					id: deviceOf(accounts, session.id),
					lastActivityAt: DateTime.formatIso(session.lastActivityAt),
					startedAt: DateTime.formatIso(session.startedAt),
					user: { ...session.user, id: personOf(accounts, session.user.id) },
				}));
			}),
		nextCursor: () =>
			Effect.sync(() => {
				if (page === undefined) {
					throw new Error("No sessions page was received");
				}
				return Option.getOrThrowWith(page.next, () => new Error("The sessions page has no next cursor"));
			}),
		request: (actor: Actor) => {
			story.tell(`${actor} requests their protected profile`);
			return host.client(headersOf(accounts, actor)).pipe(
				Effect.flatMap((rpc) => rpc["profile.read"]()),
				Effect.map((user) => user.name),
				Effect.scoped,
				answered,
			);
		},
		revoke: Effect.fnUntraced(function* (device: Device | "unknown", actor: Actor = "alice") {
			story.tell(`${actor} revokes ${device}'s session`);
			revokeAnswer = yield* host.client(headersOf(accounts, actor)).pipe(
				Effect.flatMap((rpc) => rpc["identity.sessions.revoke"]({ id: device === "unknown" ? "unknown-session" : accounts[device].session.id })),
				Effect.as("revoked"),
				Effect.scoped,
				(effect) => answered(effect, decodedErrorWords),
			);
		}),
		revokeAnswer: () => Effect.sync(() => revokeAnswer),
		subscriptionEnding: () => {
			if (subscription === undefined) {
				throw new Error("No profile subscription was opened");
			}
			return subscription;
		},
	};
}
