import * as Atom from "effect/reactivity/Atom";
import { resumeSources } from "#resumeSources.ts";

export type ResumeSource = (resume: () => void) => () => void;

type ResumeEvent = "online" | "visibilitychange" | "pageshow";

export interface ResumeWindow {
	readonly addEventListener: (type: ResumeEvent, listener: () => void) => void;
	readonly document: { readonly visibilityState: string };
	readonly removeEventListener: (type: ResumeEvent, listener: () => void) => void;
}

export interface ResumeOptions {
	readonly native?: ResumeSource;
	readonly window?: ResumeWindow;
}

export function resumeSignal(options: ResumeOptions): Atom.Atom<number> {
	const sources = resumeSources(options);
	return Atom.readable((get) => {
		let count = 0;
		function resume() {
			count += 1;
			get.setSelf(count);
		}
		for (const source of sources) {
			get.addFinalizer(source(resume));
		}
		return count;
	});
}
