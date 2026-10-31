import { Effect, Option, Predicate } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { session } from "#client/session.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";
import { setNativeValue } from "./setNativeValue.ts";

const ARRIVAL_LIMIT = "10 seconds";

function liveSession(engine: ScreenEngine) {
	if (!engine.session) {
		throw new Error("The story has no live session; add liveForm()");
	}
	return engine.session;
}

function settledResult(node: AtomRegistry.Node<unknown>) {
	const value = node.valueOption();
	return Option.isSome(value) && AsyncResult.isAsyncResult(value.value) && !value.value.waiting ? value.value : undefined;
}

function settledResults(engine: ScreenEngine) {
	const values = new Map<AtomRegistry.Node<unknown>, unknown>();
	for (const node of session(liveSession(engine).environment).registry.getNodes().values()) {
		const value = settledResult(node);
		if (value !== undefined && node.listeners.size > 0) {
			values.set(node, value);
		}
	}
	return values;
}

function changeArrives(observed: ReadonlyMap<AtomRegistry.Node<unknown>, unknown>, write: () => void) {
	return new Promise<void>((resolve) => {
		const stops = [...observed].map(([node, before]) =>
			node.subscribe(() => {
				const after = settledResult(node);
				if (after !== undefined && after !== before) {
					for (const stop of stops) {
						stop();
					}
					resolve();
				}
			}),
		);
		write();
	});
}

type Kind = "response" | "handoff";

function control<T extends HTMLElement>(selector: string) {
	const found = document.querySelector<T>(selector);
	if (!found) {
		throw new Error(`The live form has no ${selector}`);
	}
	return found;
}

function draftBox(kind: Kind) {
	return control<HTMLTextAreaElement>(kind === "response" ? "#response-form [name='body']" : "#handoff-form [name='goal']");
}

export function liveFormVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	function settle() {
		return screenSettles(engine, tell);
	}
	function perform(line: string, action: () => void) {
		return Effect.sync(() => tell(line)).pipe(Effect.andThen(Effect.promise(() => act(async () => action()))), Effect.andThen(settle()));
	}
	function read<T>(line: string, value: () => T) {
		return Effect.sync(() => {
			tell(line);
			return value();
		});
	}
	return {
		fillLiveForm: (kind: Kind, text: string) =>
			perform(`the reader writes ${JSON.stringify(text)} as the ${kind === "response" ? "answer" : "handoff goal, for local-reviewer"}`, () => {
				const recipient: ReadonlyArray<readonly [HTMLInputElement, string]> =
					kind === "response" ? [] : [[control<HTMLInputElement>("#handoff-form [name='recipient']"), "local-reviewer"]];
				const fields: ReadonlyArray<readonly [HTMLInputElement | HTMLTextAreaElement, string]> = [...recipient, [draftBox(kind), text]];
				for (const [field, value] of fields) {
					setNativeValue(field, value);
					field.dispatchEvent(new Event("input", { bubbles: true }));
				}
			}),
		liveFormDraft: (kind: Kind) => read(`the reader reads the ${kind} draft`, () => draftBox(kind).value),
		liveFormStatus: (kind: Kind) =>
			read(`the reader reads the ${kind} status line`, () => document.querySelector(`#${kind}-status`)?.textContent ?? "none"),
		// The live session reports an outside change by refetching the page's queries, so the change has arrived once an observed query holds a new result.
		outsideEditorWrites: (path: string, source: string) =>
			Effect.gen(function* () {
				tell(`an outside editor writes ${path}, and the page waits for the live session to deliver the change`);
				const observed = settledResults(engine);
				yield* Effect.promise(() => act(() => changeArrives(observed, () => liveSession(engine).notes.write(path, source)))).pipe(
					Effect.timeoutOrElse({
						duration: ARRIVAL_LIMIT,
						orElse: () => Effect.die(new Error(`The live session did not deliver the change to ${path} within ${ARRIVAL_LIMIT}`)),
					}),
				);
				yield* screenSettles(engine, tell);
			}),
		previewLiveForm: (kind: Kind) => perform(`the reader previews the ${kind} file`, () => control(`#${kind}-preview`).click()),
		saveLiveForm: (kind: Kind) =>
			perform(`the reader presses ${kind === "response" ? "Record answer" : "Prepare handoff"}`, () => control(`#${kind}-submit`).click()),
		sentCommandIds: () =>
			read("the reader lists the identities of the save commands the page sent", () => {
				if (!engine.sessionTransport) {
					throw new Error("The story records no session commands; add sessionBoundary()");
				}
				return engine.sessionTransport.commands.map(({ payload }) =>
					Predicate.hasProperty(payload, "id") && typeof payload.id === "string" ? payload.id : "no identity",
				);
			}),
	};
}
