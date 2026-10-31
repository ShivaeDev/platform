import { Deferred, Effect } from "effect";
import type { BrowserWindow } from "happy-dom";
import { type BoardEngine, connected } from "./storyEngine.ts";

const QUIET_MS = 10;
const SETTLE_MS = 10_000;
const INDEXING = "work-board.indexing";

interface Answer {
	readonly tag: string;
	readonly value: unknown;
}

// Records each RPC request the bundle page sends over its socket, each answer it receives and each change to its document, so a wait can follow the page's own traffic.
export class PageTraffic {
	readonly answers: Answer[] = [];
	readonly outstanding = new Map<string | number, string>();
	readonly released = new Set<string>();
	answersAtSettle = 0;
	requests = 0;
	#wake = Promise.withResolvers<void>();

	sent(data: string) {
		for (const message of lines(data)) {
			if (
				message._tag === "Request"
				&& (typeof message.id === "string" || typeof message.id === "number")
				&& typeof message.tag === "string"
				&& !message.tag.endsWith(".$changes")
			) {
				this.outstanding.set(message.id, message.tag);
				this.requests += 1;
			}
		}
		this.#bump();
	}

	received(data: string) {
		for (const message of lines(data)) {
			const tag =
				typeof message.requestId === "string" || typeof message.requestId === "number" ? this.outstanding.get(message.requestId) : undefined;
			if (message._tag === "Exit" && tag !== undefined && (typeof message.requestId === "string" || typeof message.requestId === "number")) {
				this.outstanding.delete(message.requestId);
				this.answers.push({ tag, value: message.exit?.value });
			}
		}
		this.#bump();
	}

	changed() {
		this.#bump();
	}

	activity() {
		return this.#wake.promise;
	}

	#bump() {
		this.#wake.resolve();
		this.#wake = Promise.withResolvers<void>();
	}
}

interface Message {
	readonly _tag?: unknown;
	readonly exit?: { readonly value?: unknown };
	readonly id?: unknown;
	readonly requestId?: unknown;
	readonly tag?: unknown;
}

function lines(data: string): readonly Message[] {
	return data
		.trim()
		.split("\n")
		.filter((line) => line !== "")
		.map((line): Message => JSON.parse(line));
}

const traffic = new WeakMap<BoardEngine, PageTraffic>();

function install(engine: BoardEngine, window: BrowserWindow) {
	const recorder = new PageTraffic();
	traffic.set(engine, recorder);
	for (const [method, hold] of engine.heldRequests ?? []) {
		void hold.gate.then(() => recorder.released.add(method));
	}
	new window.MutationObserver(() => recorder.changed()).observe(window.document, {
		attributes: true,
		characterData: true,
		childList: true,
		subtree: true,
	});
	const Boundary = window.WebSocket;
	Object.defineProperty(window, "WebSocket", {
		value: class extends Boundary {
			constructor(url: string, protocols?: string | string[]) {
				super(url, protocols);
				this.addEventListener("message", (event) => {
					if (event instanceof window.MessageEvent && typeof event.data === "string") {
						recorder.received(event.data);
					}
				});
			}
			override send(data: Parameters<InstanceType<BrowserWindow["WebSocket"]>["send"]>[0]) {
				if (typeof data === "string") {
					recorder.sent(data);
				}
				super.send(data);
			}
		},
	});
}

export function pageTrafficScripts(engine: BoardEngine, before?: BoardEngine["beforeScripts"]): NonNullable<BoardEngine["beforeScripts"]> {
	return (window, mermaid) => {
		install(engine, window);
		return before?.(window, mermaid);
	};
}

export function recordedTraffic(engine: BoardEngine) {
	const recorder = traffic.get(engine);
	if (!recorder) {
		throw new Error("The page does not record its traffic. Add the pageTraffic() project trait before the reader trait.");
	}
	return recorder;
}

function reading(engine: BoardEngine) {
	return engine.reads?.gate !== undefined && !Deferred.isDoneUnsafe(engine.reads.gate);
}

function holding(engine: BoardEngine, recorder: PageTraffic, tag: string) {
	return engine.heldRequests?.has(tag) === true && !recorder.released.has(tag);
}

function waiting(engine: BoardEngine, recorder: PageTraffic) {
	return [...recorder.outstanding.values()].filter((tag) => !holding(engine, recorder, tag) && (!reading(engine) || tag === INDEXING));
}

// A page that is still loading code shows its own busy status until the code arrives; while the story holds reads, that status is expected.
function busy(engine: BoardEngine, recorder: PageTraffic, window: BrowserWindow) {
	const held = reading(engine) || [...(engine.heldRequests?.keys() ?? [])].some((tag) => holding(engine, recorder, tag));
	return !held && window.document.querySelector('#doc [role="status"][aria-busy="true"]') !== null;
}

async function quiet(recorder: PageTraffic) {
	const timer = Promise.withResolvers<"quiet">();
	const handle = setTimeout(() => timer.resolve("quiet"), QUIET_MS);
	const woke = await Promise.race([timer.promise, recorder.activity().then(() => "busy" as const)]);
	clearTimeout(handle);
	return woke === "quiet";
}

async function settle(engine: BoardEngine, window: BrowserWindow, recorder: PageTraffic, until: () => boolean, what: string) {
	const expired = Promise.withResolvers<"expired">();
	const deadline = setTimeout(() => expired.resolve("expired"), SETTLE_MS);
	try {
		for (;;) {
			if (recorder.requests > 0 && until() && waiting(engine, recorder).length === 0 && !busy(engine, recorder, window)) {
				if (await quiet(recorder)) {
					recorder.answersAtSettle = recorder.answers.length;
					return;
				}
				continue;
			}
			if ((await Promise.race([expired.promise, recorder.activity()])) === "expired") {
				throw new Error(
					`The page did not ${what} within ${SETTLE_MS}ms; it still waits on ${JSON.stringify(waiting(engine, recorder))}${busy(engine, recorder, window) ? " and shows a busy status" : ""}`,
				);
			}
		}
	} finally {
		clearTimeout(deadline);
	}
}

export function pageSettlesOn(
	engine: BoardEngine,
	tell: (line: string) => void,
	line: string,
	until: (answers: readonly Answer[], since: number) => boolean,
) {
	return Effect.promise(async () => {
		tell(line);
		const recorder = recordedTraffic(engine);
		const since = recorder.answersAtSettle;
		await settle(engine, connected(engine).page.window, recorder, () => until(recorder.answers, since), line.replace(/^the page /u, ""));
	});
}
