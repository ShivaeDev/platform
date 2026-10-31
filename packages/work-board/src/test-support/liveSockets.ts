import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { Effect, type Fiber } from "effect";
import type { boardCommand } from "./boardCommand.ts";
import type { shutdownConnection } from "./shutdownConnection.ts";
import { socketRpc } from "./socketRpc.ts";
import type { socketStartup } from "./socketStartup.ts";
import type { BoardEngine } from "./storyEngine.ts";

export interface BoardPlace {
	readonly root: string;
	readonly url: string;
}

export function octal(path: string) {
	return (statSync(path).mode & 0o777).toString(8);
}

export function socketFileOf(root: string) {
	const path = join(root, "board.sock");
	if (!existsSync(path)) {
		return "missing";
	}
	if (!statSync(path).isSocket()) {
		return "not a socket";
	}
	const mode = octal(path);
	return mode === "600" ? "owner read-write socket" : `socket with mode ${mode}`;
}

function exitOf(frames: readonly unknown[]) {
	for (const frame of frames) {
		if (typeof frame === "object" && frame !== null && "_tag" in frame && frame._tag === "Exit" && "exit" in frame) {
			const exit: unknown = frame.exit;
			if (typeof exit === "object" && exit !== null && "_tag" in exit) {
				return exit._tag === "Success" && "value" in exit ? { value: exit.value } : { failure: JSON.stringify(exit) };
			}
		}
	}
	return { failure: `no answer in ${JSON.stringify(frames)}` };
}

function unreachable(error: unknown) {
	return typeof error === "object" && error !== null && "code" in error ? `unreachable: ${String(error.code)}` : `unreachable: ${String(error)}`;
}

export function socketCall(address: string, tag: string) {
	return Effect.promise(() =>
		socketRpc(address, tag).then(
			(frames) => exitOf(frames),
			(error: unknown) => ({ failure: unreachable(error) }),
		),
	);
}

export function serverAnswerOf(address: string, label: (text: string) => string) {
	return Effect.map(socketCall(address, "work-board.server"), (answer) => {
		if ("failure" in answer) {
			return answer.failure;
		}
		const value = answer.value;
		if (typeof value === "object" && value !== null && "directory" in value && "url" in value) {
			return { directory: label(String(value.directory)), url: label(String(value.url)) };
		}
		return `unexpected answer: ${JSON.stringify(value)}`;
	});
}

export function sameOverBoth(place: BoardPlace, tag: string) {
	return Effect.map(Effect.all([socketCall(join(place.root, "board.sock"), tag), socketCall(place.url, tag)]), ([local, tcp]) => {
		if ("failure" in local) {
			return `socket failed: ${local.failure}`;
		}
		if ("failure" in tcp) {
			return `TCP failed: ${tcp.failure}`;
		}
		return JSON.stringify(local.value) === JSON.stringify(tcp.value)
			? "the same answer over socket and TCP"
			: "different answers over socket and TCP";
	});
}

type Command = Effect.Success<ReturnType<typeof boardCommand>>;
type Worker = Effect.Success<ReturnType<typeof socketStartup>>;
type Unfinished = Effect.Success<ReturnType<typeof shutdownConnection>>;

interface SocketState {
	command?: Command;
	commandStop?: number;
	readonly labels: Map<string, string>;
	other?: BoardPlace;
	search?: Fiber.Fiber<readonly string[], unknown>;
	readonly staged: Map<string, string>;
	stopped?: number;
	unfinished?: Unfinished;
	readonly workers: Map<string, Worker>;
}

const states = new WeakMap<BoardEngine, SocketState>();

export function socketState(engine: BoardEngine) {
	let state = states.get(engine);
	if (!state) {
		state = { labels: new Map(), staged: new Map(), workers: new Map() };
		states.set(engine, state);
	}
	return state;
}
