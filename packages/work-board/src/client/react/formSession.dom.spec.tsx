import { Effect } from "effect";
import { Window } from "happy-dom";
import { act } from "react";
import { afterEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { session } from "#client/session.ts";
import { folder, startBoard } from "#test/board.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { mountBoard } from "./mountBoard.tsx";

let activeTransport: Window;
function transportFetch(...args: Parameters<Window["fetch"]>) {
	return activeTransport.fetch(...args);
}

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
it.live.each(["response", "handoff"] as const)("saves %s through the replacement session's command and runtime after pageshow", function* (kind) {
	browserStorage();
	const notes = folder({ "item.md": EDGE_ATTENTION_SOURCE });
	yield* Effect.addFinalizer(() => Effect.sync(() => notes.remove()));
	const board = yield* startBoard(notes.root, undefined, undefined, true);
	const transport = new Window({ url: board.url });
	activeTransport = transport;
	vi.stubGlobal("fetch", transportFetch);
	yield* Effect.addFinalizer(() => Effect.promise(() => transport.happyDOM.abort()));
	const environment: Parameters<typeof session>[0] = {
		addEventListener: (type, listener) => window.addEventListener(type, listener),
		document,
		location: { origin: board.url },
		removeEventListener: (type, listener) => window.removeEventListener(type, listener),
	};
	const first = session(environment);
	const oldCommand = vi.spyOn(kind === "response" ? first.responses.recordResponse : first.handoffs.prepareHandoff, "run");
	const container = document.createElement("div");
	document.body.append(container);
	history.replaceState(null, "", kind === "response" ? "/_board/item/item.edge/" : "/_board/handoff?item=item.edge");
	window.dispatchEvent(new PopStateEvent("popstate"));
	let unmount: (() => void) | undefined;
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			act(() => {
				unmount?.();
				window.dispatchEvent(new Event("pagehide"));
			});
			container.remove();
		}),
	);
	yield* Effect.sync(() => {
		act(() => {
			unmount = mountBoard(container, () => session(environment));
		});
	});
	yield* Effect.promise(() =>
		eventually(() => expect(document.getElementById(`${kind}-form`), `${window.location.href} ${container.textContent}`).not.toBeNull()),
	);
	function edit(name: string, value: string) {
		const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
		if (!field) {
			throw new Error(`Missing ${name}`);
		}
		act(() => {
			field.value = value;
			field.dispatchEvent(new Event("input", { bubbles: true }));
		});
	}
	edit(kind === "response" ? "author" : "recipient", "local-reviewer");
	edit(kind === "response" ? "body" : "goal", "Direction before replacement");
	let replacement = first;
	let command = oldCommand;
	let runtime = vi.spyOn(first.runtime, "fn");
	yield* Effect.sync(() => {
		act(() => {
			window.dispatchEvent(new Event("pagehide"));
			replacement = session(environment);
			runtime = vi.spyOn(replacement.runtime, "fn");
			command = vi.spyOn(kind === "response" ? replacement.responses.recordResponse : replacement.handoffs.prepareHandoff, "run");
			window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
		});
	});
	expect(replacement).not.toBe(first);
	yield* Effect.promise(() => eventually(() => expect(document.getElementById(`${kind}-preview`)).toHaveProperty("disabled", false)));
	expect(container.querySelector(kind === "response" ? '[name="body"]' : '[name="goal"]')).toHaveProperty("value", "Direction before replacement");
	yield* Effect.sync(() =>
		act(() => {
			document.getElementById(`${kind}-preview`)?.click();
		}),
	);
	yield* Effect.sync(() =>
		act(() => {
			document.getElementById(`${kind}-form`)?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		}),
	);
	yield* Effect.promise(() =>
		eventually(() => expect(document.getElementById(`${kind}-status`)?.textContent).toContain(kind === "response" ? "Saved:" : "Prepared:")),
	);
	expect(runtime).toHaveBeenCalled();
	expect(command).toHaveBeenCalledTimes(1);
	expect(oldCommand).not.toHaveBeenCalled();
});
