import { Deferred, Effect, Stream } from "effect";
import type { BrowserWindow } from "happy-dom";
import { until } from "@shivaedev/test-story/server/until.ts";
import { type BoardEngine, connected } from "./storyEngine.ts";

const SETTLE_MS = 10_000;
const INDEXING = "work-board.indexing";

import { type Answer, PageTraffic } from "./pageTrafficMonitor.ts";

const traffic = new WeakMap<BoardEngine, PageTraffic>();

function install(engine: BoardEngine, window: BrowserWindow) {
	const recorder = new PageTraffic();
	traffic.set(engine, recorder);
	for (const [method, hold] of engine.heldRequests ?? []) {
		void hold.gate.then(() => {
			recorder.released.add(method);
			recorder.changed();
		});
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
	const mainHeld = reading(engine) || holding(engine, recorder, "work-board.inbox");
	return (
		(!mainHeld
			&& (window.document.querySelector('#doc [role="status"][aria-busy="true"]') !== null
				|| !window.document.getElementById("doc")?.getAttribute("data-route")))
		|| window.document.querySelector('#live[data-state="connecting"]') !== null
		|| (!held && window.document.querySelector('#live[data-state="refreshing"]') !== null)
	);
}

export const pageSettlesOn = Effect.fn("Story.pageSettlesOn")(function* (
	engine: BoardEngine,
	tell: (line: string) => void,
	line: string,
	matches: (answers: readonly Answer[], since: number) => boolean,
) {
	tell(line);
	const recorder = recordedTraffic(engine);
	const since = recorder.answersAtSettle;
	const window = connected(engine).page.window;
	const current = Effect.sync(() => ({
		pending: recorder.requests === 0 || !matches(recorder.answers, since) || busy(engine, recorder, window),
		requests: waiting(engine, recorder),
	}));
	const changes = Stream.fromEffectRepeat(Effect.promise(() => recorder.activity()).pipe(Effect.andThen(current)));
	yield* until(Stream.concat(Stream.fromEffect(current), changes), (state) => !state.pending && state.requests.length === 0, {
		name: line,
		timeout: SETTLE_MS,
	});
	recorder.answersAtSettle = recorder.answers.length;
});
