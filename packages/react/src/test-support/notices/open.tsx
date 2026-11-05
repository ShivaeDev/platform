import { Clock, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type { Screen } from "#test/Screen.ts";
import { type State, settle } from "./state.ts";
import { type NoticeScreen, NoticeView } from "./view.tsx";

interface Engine {
	readonly screen: Screen;
	readonly state: State;
}

export function* open({ screen, state }: Engine, options: Partial<NoticeScreen>) {
	state.clock = yield* Clock.Clock;
	state.current = { ...state.current, clock: Atom.runtime(Layer.succeed(Clock.Clock, state.clock)), ...options };
	state.view = yield* screen.open(<NoticeView state={state.current} />);
	yield* settle(state, screen);
}

export function optionWords(options: Partial<NoticeScreen>) {
	const parts = [
		options.editor && "an editor screen",
		options.host === false && "no notice host",
		options.queryFailure && "a query whose first load fails",
		options.uninterruptible && "uninterruptible Undo",
		options.expiresIn !== undefined && `notices that expire after ${options.expiresIn} ms`,
	].filter(Boolean);
	return parts.length === 0 ? "" : ` with ${parts.join(", ")}`;
}
