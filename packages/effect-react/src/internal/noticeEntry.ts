import { Duration } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { NoticeDescriptor } from "#notices.ts";

export interface NoticeAction {
	readonly atom: Atom.AtomResultFn<void, unknown, unknown>;
	readonly label: NoticeDescriptor["message"];
}
export interface NoticeEntry {
	readonly action?: { readonly label: NoticeDescriptor["message"]; readonly run: () => void } | undefined;
	readonly dismiss: () => void;
	readonly id: number;
	readonly message: NoticeDescriptor["message"];
	readonly release: () => void;
	readonly status: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>;
}
const idle = Atom.make(AsyncResult.initial<unknown, unknown>());
export function noticeEntry(
	registry: AtomRegistry.AtomRegistry,
	id: number,
	descriptor: Pick<NoticeDescriptor, "message" | "expiresIn">,
	remove: (id: number) => void,
	action: NoticeAction | undefined,
): NoticeEntry {
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
	const resource = Atom.make((get) => {
		if (action) {
			get.mount(action.atom);
		}
		if (descriptor.expiresIn !== undefined) {
			const timer = setTimeout(dismiss, Duration.toMillis(descriptor.expiresIn));
			get.addFinalizer(() => clearTimeout(timer));
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
