import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { NoticeDescriptor } from "#noticeTypes.ts";

export interface NoticeAction<TMessage = unknown> {
	readonly atom: Atom.AtomResultFn<void, unknown, unknown>;
	readonly label: TMessage;
}
export type NoticeClock = Pick<Atom.AtomRuntime<never, unknown>, "atom">;
export interface NoticeEntry<TMessage = unknown> {
	readonly action?: { readonly label: TMessage; readonly run: () => void } | undefined;
	readonly dismiss: () => void;
	readonly id: number;
	readonly message: TMessage;
	readonly release: () => void;
	readonly status: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>;
}
const idle = Atom.make(AsyncResult.initial<unknown, unknown>());
export function noticeEntry<TMessage>(
	registry: AtomRegistry.AtomRegistry,
	clock: NoticeClock,
	id: number,
	descriptor: Pick<NoticeDescriptor<never, TMessage>, "message" | "expiresIn">,
	remove: (id: number) => void,
	action: NoticeAction<TMessage> | undefined,
): NoticeEntry<TMessage> {
	let active = true;
	function dismiss() {
		if (active) {
			remove(id);
			release();
		}
	}
	function run() {
		if (active && action && !registry.get(action.atom).waiting) {
			registry.set(action.atom, undefined);
		}
	}
	const expiry =
		descriptor.expiresIn === undefined
			? undefined
			: clock.atom(Effect.andThen(Effect.sleep(descriptor.expiresIn), Effect.sync(dismiss))).pipe(Atom.setIdleTTL(0));
	const resource = Atom.make((get) => {
		if (action) {
			get.mount(action.atom);
		}
		if (expiry) {
			get.mount(expiry);
		}
		return true;
	}).pipe(Atom.setIdleTTL(0));
	const unmount = registry.mount(resource);
	function release() {
		active = false;
		if (action) {
			registry.set(action.atom, Atom.Interrupt);
		}
		unmount();
	}
	return {
		action: action === undefined ? undefined : { label: action.label, run },
		dismiss,
		id,
		message: descriptor.message,
		release,
		status: action?.atom ?? idle,
	};
}
