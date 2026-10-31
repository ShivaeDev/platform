import { readFileSync } from "node:fs";
import { STATUS_CODES } from "node:http";
import { isAbsolute, join } from "node:path";
import { Cause, Effect } from "effect";
import { Window } from "happy-dom";
import { boardInit, readBoard } from "@shivaedev/work-board-plugin/board.ts";
import { answersTo, type Board } from "@shivaedev/work-board-plugin/boardTools.ts";
import { rpcInit } from "@shivaedev/work-board-plugin/rpc.ts";
import type { Exchange } from "./board.ts";
import { rpcDocument, rpcWatcher, subscribe } from "./nativeRpc.ts";
import { type ServingOptions, startProject } from "./servingEngine.ts";
import { type LinkTarget, resolvedTarget } from "./servingLinks.ts";
import { servingObservations } from "./servingObservations.ts";
import { socketExchange } from "./socketRpc.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export const PLUGIN_DIRECTORY = "/project";

export const CHANGE_LIMIT = "15 seconds";

export function header(response: Exchange, name: string) {
	const value = response.headers[name];
	return Array.isArray(value) ? value.join(", ") : value;
}

export function statusPhrase(status: number) {
	return STATUS_CODES[status] ?? `HTTP ${status}`;
}

export function described(response: Exchange) {
	return {
		bytes: Buffer.from(response.body),
		cacheControl: header(response, "cache-control"),
		contentSecurityPolicy: header(response, "content-security-policy"),
		encoding: header(response, "content-encoding") ?? "none",
		etag: header(response, "etag"),
		location: header(response, "location"),
		sniffing: header(response, "x-content-type-options") === "nosniff" ? "refused" : "allowed",
		status: statusPhrase(response.status),
		text: response.text,
		type: header(response, "content-type"),
		vary: header(response, "vary"),
	};
}

export function shellOf(html: string) {
	const window = new Window();
	try {
		const page = new window.DOMParser().parseFromString(html, "text/html");
		return {
			legacy: [...page.querySelectorAll("noscript, template, style, link[href$='style.css']")].map((node) => node.tagName.toLowerCase()),
			skeleton: [...page.querySelectorAll("[data-board-skeleton] :is(aside, header, nav)")].map((node) => node.tagName.toLowerCase()),
			stylesheets: [...page.head.querySelectorAll("link[rel=stylesheet]")].map((node) => node.getAttribute("href")),
			viewport: page.querySelector("meta[name=viewport]")?.getAttribute("content"),
		};
	} finally {
		void window.happyDOM.close();
	}
}

export function bodyOf(source: string) {
	return source.replace(/^---\n[\s\S]*?\n---\n/u, "");
}

export function failureMessage(cause: Cause.Cause<unknown>) {
	const error = Cause.squash(cause);
	return error instanceof Error ? error.message : String(error);
}

export function servingBoardReads(engine: BoardEngine, tell: (line: string) => void) {
	function inWorkspace(message: string) {
		return message.replaceAll(engine.notes.root, "<workspace>");
	}
	function documentAt(url: string) {
		return rpcDocument(served(engine).board, url).pipe(
			Effect.map((document) => document.source),
			Effect.catchTag("NotFound", () => Effect.succeed("not found")),
		);
	}
	function linked() {
		if (!engine.linked) {
			throw new Error("No linked project was prepared");
		}
		return engine.linked;
	}
	// Each live hint is the board announcing that its index moved; the read after it shows whether this change has landed yet.
	function changeSeen(line: string, change: (() => void) | Effect.Effect<unknown>, landed: Effect.Effect<boolean, unknown>) {
		return Effect.scoped(
			Effect.gen(function* () {
				tell(line);
				const events = yield* subscribe(served(engine).board);
				yield* events.next();
				if (Effect.isEffect(change)) {
					yield* change;
				} else {
					change();
				}
				for (;;) {
					yield* events.next();
					if (yield* landed) {
						return;
					}
				}
			}),
		).pipe(
			Effect.timeoutOrElse({ duration: CHANGE_LIMIT, orElse: () => Effect.die(new Error(`The board never showed this change: ${line}`)) }),
			Effect.orDie,
		);
	}
	function shows(url: string, source: string) {
		return Effect.map(documentAt(url), (read) => read === bodyOf(source));
	}
	function gone(url: string) {
		return Effect.map(documentAt(url), (read) => read === "not found");
	}
	function linkShows(path: string, target: LinkTarget, file: string) {
		return Effect.suspend(() => {
			const folder = resolvedTarget(engine, target);
			return shows(`/${path}/${file}`, readFileSync(join(isAbsolute(folder) ? folder : join(engine.notes.root, folder), file), "utf8"));
		});
	}
	function launched(options?: ServingOptions) {
		return Effect.gen(() => startProject(engine, options)).pipe(
			Effect.matchCause({ onFailure: (cause) => `refused: ${inWorkspace(failureMessage(cause))}`, onSuccess: () => "serving" }),
		);
	}
	function pluginReply() {
		return Effect.promise(() => socketExchange(join(engine.notes.root, "board.sock"), boardInit(PLUGIN_DIRECTORY)));
	}
	function pluginBoard(at: number) {
		return Effect.map(pluginReply(), (reply) => {
			const board = readBoard(reply, PLUGIN_DIRECTORY, at);
			if (board.kind !== "ready") {
				throw new Error(`The plugin could not read the board: ${JSON.stringify(board)}`);
			}
			return board;
		});
	}
	function pluginTools(): Board {
		return {
			ask: (requests) =>
				socketExchange(join(engine.notes.root, "board.sock"), rpcInit(PLUGIN_DIRECTORY, requests)).then((reply) =>
					answersTo(requests, reply.text, PLUGIN_DIRECTORY),
				),
			now: 61_000,
		};
	}
	function watching() {
		return Effect.map(rpcWatcher(served(engine).board), (status) => status.watching);
	}
	function watchTurns(line: string, turn: () => Effect.Effect<unknown>, wanted: boolean) {
		return Effect.scoped(
			Effect.gen(function* () {
				tell(line);
				const events = yield* subscribe(served(engine).board);
				yield* events.next();
				yield* turn();
				for (;;) {
					yield* events.next();
					if ((yield* watching()) === wanted) {
						return;
					}
				}
			}),
		).pipe(Effect.orDie);
	}
	function notifications() {
		const instrument = servingObservations(engine).notifications;
		if (!instrument) {
			throw new Error("Add the directoryNotificationsDelivered trait before notifying");
		}
		return instrument;
	}
	function watch() {
		const instrument = servingObservations(engine).watch;
		if (!instrument) {
			throw new Error("Add the watchCanFail trait before failing the watch");
		}
		return instrument;
	}
	return {
		changeSeen,
		documentAt,
		gone,
		inWorkspace,
		launched,
		linked,
		linkShows,
		notifications,
		pluginBoard,
		pluginReply,
		pluginTools,
		shows,
		watch,
		watching,
		watchTurns,
	};
}
