import { Deferred, Effect, Queue } from "effect";
import type { LineProcess } from "#adapters/process.ts";
import { PINNED_CLI_VERSION } from "#adapters/protocol.ts";
import { children } from "#test/children.ts";
import { models } from "#test/models.ts";

interface Frame {
	error?: unknown;
	id?: number | string;
	method?: string;
	params?: Record<string, unknown>;
	result?: unknown;
}
export const scriptedPeer = Effect.fn("Codex.scriptedPeer")(function* () {
	const received = yield* Queue.unbounded<Frame>();
	const submitted = yield* Deferred.make<void>();
	const answered = yield* Queue.unbounded<Frame>();
	const frames: Frame[] = [];
	const replies: Frame[] = [];
	const processEvents: string[] = [];
	const history: { id: string; status: string; items: unknown[] }[] = [];
	let line: (text: string) => void = () => {
		throw new Error("Connect the peer first");
	};
	let exit: () => void = () => undefined;
	let loseAcknowledgement = false;
	let drainRejection = false;
	let noActiveTurn = false;
	let startRejection: unknown | undefined;
	let turnCount = 0;
	let toolCount = 0;
	function notify(method: string, params: unknown) {
		return line(JSON.stringify({ method, params }));
	}
	function respond(id: number | string | undefined, result: unknown) {
		return line(JSON.stringify({ id, result }));
	}

	function submit(id: number | string | undefined, params: Record<string, unknown>) {
		if (startRejection !== undefined) {
			line(JSON.stringify({ error: startRejection, id }));
			return;
		}
		turnCount += 1;
		const turn = {
			id: `turn-${turnCount}`,
			items: [{ clientId: params.clientUserMessageId, content: params.input, id: `user-${turnCount}`, type: "userMessage" }],
			status: "inProgress",
		};
		history.push(turn);
		Deferred.doneUnsafe(submitted, Effect.void);
		if (!loseAcknowledgement) {
			respond(id, { turn });
		}
	}
	const peer: LineProcess = {
		kill: () => {
			processEvents.push("stopped");
			exit();
		},
		onExit: (listener) => {
			exit = () => listener(0);
		},
		onLine: (listener) => {
			line = listener;
		},
		onStderr: () => undefined,
		write: (raw) => {
			const frame: Frame = JSON.parse(raw);
			frames.push(frame);
			Queue.offerUnsafe(received, frame);
			const { id, method, params = {} } = frame;
			if (method === undefined) {
				replies.push(frame);
				Queue.offerUnsafe(answered, frame);
				return;
			}
			switch (method ?? "") {
				case "initialize":
					respond(id, { userAgent: `codex/${PINNED_CLI_VERSION} linux` });
					break;
				case "thread/start":
				case "thread/resume":
					respond(id, { thread: { id: params.threadId ?? "root" } });
					break;
				case "turn/start":
					submit(id, params);
					break;
				case "thread/turns/list":
					respond(id, { data: history, nextCursor: null });
					break;
				case "thread/items/list":
					respond(id, { data: (history.find((turn) => turn.id === params.turnId)?.items ?? []).map((item) => ({ item })), nextCursor: null });
					break;
				case "turn/steer":
					respond(id, { turnId: params.expectedTurnId });
					break;
				case "turn/interrupt":
					if (noActiveTurn) {
						line(JSON.stringify({ error: { code: -32_000, message: "no active turn" }, id }));
					} else if (drainRejection) {
						line(JSON.stringify({ error: { code: -32_000, message: "timeout waiting for turn to drain" }, id }));
					} else {
						respond(id, {});
					}
					break;
				case "thread/list":
					respond(id, children);
					break;
				case "model/list":
					respond(id, models);
					break;
			}
		},
	};
	return {
		anotherOperationCompleted: () => {
			for (const turn of history) {
				turn.status = "completed";
			}
			history.unshift({
				id: "newer-foreign-turn",
				items: [{ clientId: "another-operation", content: [{ text: "unrelated work", type: "text" }], id: "foreign-user", type: "userMessage" }],
				status: "completed",
			});
		},
		answered,
		clearHistory: () => {
			history.splice(0);
		},
		drainRejection: () => {
			drainRejection = true;
		},
		duplicateOperation: () => {
			const first = history[0];
			if (first !== undefined) {
				history.push({ ...first, id: "duplicate" });
			}
		},
		exit: () => exit(),
		finish: (turnId: string) => {
			const turn = history.find((candidate) => candidate.id === turnId);
			if (turn !== undefined) {
				turn.status = "interrupted";
				notify("turn/completed", { threadId: "root", turn });
			}
		},
		frames,
		item: (item: unknown) => {
			history[0]?.items.push(item);
			notify("item/completed", { item, threadId: "root", turnId: "turn-1" });
		},
		loseAcknowledgement: () => {
			loseAcknowledgement = true;
		},
		noActiveTurn: () => {
			noActiveTurn = true;
		},
		notify,
		processEvents,
		received,
		rejectStart: (code: string) => {
			startRejection = { code: -32_001, data: { codexErrorInfo: code }, message: "Provider capacity refusal" };
		},
		replies,
		serverRequest: (method: string, params: unknown) => {
			line(JSON.stringify({ id: "provider-request", method, params }));
		},
		spawn: () => {
			processEvents.push("started");
			return peer;
		},
		submitted,
		tool: (threadId = "root") => {
			toolCount += 1;
			const id = `tool-${toolCount}`;
			line(JSON.stringify({ id, method: "item/tool/call", params: { arguments: { query: "Effect" }, callId: id, threadId, tool: "lookup" } }));
			return id;
		},
	};
});
export type ScriptedPeer = Effect.Success<ReturnType<typeof scriptedPeer>>;
