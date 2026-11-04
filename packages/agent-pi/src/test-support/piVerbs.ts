import { rm } from "node:fs/promises";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { Effect, Scope, Stream } from "effect";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import type { piState } from "#test/piState.ts";

function input(text: string | readonly [string, string]) {
	const [first, ...rest] = typeof text === "string" ? ([text] as const) : text;
	return { parts: [{ text: first, type: "text" as const }, ...rest.map((value) => ({ text: value, type: "text" as const }))] as const };
}
export function piVerbs(state: Effect.Success<ReturnType<typeof piState>>, tell: (line: string) => void) {
	function receipt(name: string) {
		const found = state.receipts.get(name);
		if (found === undefined) {
			throw new Error(`no receipt for ${name}`);
		}
		return found;
	}
	function peerSession(name: string) {
		const found = state.peer.sessions.findLast((session) => session.session.sessionFile === receipt(name).session?.value);
		if (found === undefined) {
			throw new Error(`no Pi session for ${name}`);
		}
		return found;
	}
	return {
		abort: (name: string) => state.connection.value.agent.interruption.interrupt(receipt(name)),
		completion: (name: string) => Effect.sync(() => (peerSession(name).unsettled() === 0 ? "settled" : "pending")),
		emit: (name: string, event: AgentSessionEvent) =>
			Effect.sync(() => {
				peerSession(name).emit(event);
			}),
		events: (name: string, kind?: "execution" | "opening") =>
			Effect.suspend(() => {
				peerSession(name).emit({ followUp: [], steering: [], type: "queue_update" });
				return state.connection.value.agent.events(receipt(name)).pipe(
					Stream.takeUntil((event) => event.raw?.kind === "queue_update"),
					Stream.runCollect,
					Effect.map((events) => selectEvents(events, kind)),
				);
			}),
		inspect: (name: string) => state.connection.value.agent.inspect(receipt(name)),
		lifecycle: () => Effect.sync(() => state.peer.sessions.map((session) => session.lifecycle)),
		queue: (name: string, text: string) => state.connection.value.agent.queuedInput.queue(receipt(name), input(text)),
		receipt: (name: string) => Effect.sync(() => receipt(name)),
		removeSessionFile: (name: string) => Effect.promise(() => rm(receipt(name).reference.value)),
		result: (name: string) => Effect.sync(() => state.results.get(name)),
		resume: (name: string, previous: string, version = 1) =>
			Effect.gen(function* () {
				tell(`${name} resumes ${previous}'s saved session file`);
				const reference = receipt(previous).session;
				if (reference === undefined) {
					return yield* Effect.die("receipt has no session reference");
				}
				const opened = yield* state.connection.value.agent.sessions.resume(
					{ ...reference, version },
					{
						cwd: state.directory,
						input: input("continue"),
						operationId: name,
					},
				);
				state.receipts.set(name, opened);
				return "accepted";
			}).pipe(
				Effect.catchTag("BackendUnavailable", (error) => Effect.succeed(error.message)),
				Effect.catchTag("ProtocolFailure", (error) => Effect.succeed(`protocol: ${error.message}`)),
				Effect.tap((result) =>
					Effect.sync(() => {
						state.results.set(name, result);
					}),
				),
			),
		settle: (name: string, aborted = false) =>
			Effect.sync(() => {
				peerSession(name).settle(aborted);
			}),
		start: (name: string, text: string | readonly [string, string], model?: string, effort?: string) =>
			Effect.gen(function* () {
				tell(`${name} submits ${text}`);
				const opened = yield* state.connection.value.agent
					.start({
						cwd: state.directory,
						input: input(text),
						operationId: name,
						...(model === undefined ? {} : { model }),
						...(effort === undefined ? {} : { effort }),
					})
					.pipe(Effect.provideService(Scope.Scope, state.scope));
				state.receipts.set(name, opened);
				return "accepted";
			}).pipe(
				Effect.catchTags({
					"BackendUnavailable": (error) => Effect.succeed(`unavailable: ${error.message}`),
					"ProtocolFailure": (error) => Effect.succeed(`protocol: ${error.message}`),
					"Rejected": (error) => Effect.succeed(`rejected: ${error.message}`),
					"UnknownAcceptance": (error) => Effect.succeed(`uncertain: ${error.operationId}`),
				}),
				Effect.tap((result) =>
					Effect.sync(() => {
						state.results.set(name, result);
					}),
				),
			),
		steer: (name: string, text: string) => state.connection.value.agent.steering.steer(receipt(name), input(text)),
	};
}

function selectEvents(events: readonly RunEvent[], kind: "execution" | "opening" | undefined) {
	if (kind === undefined) {
		return events;
	}
	if (kind === "execution") {
		return events.filter((event) => event.type === "execution");
	}
	return events.filter((event) => event.type === "session.opened" || event.type === "acknowledged");
}
