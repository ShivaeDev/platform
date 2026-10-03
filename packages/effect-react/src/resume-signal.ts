import * as Atom from "effect/unstable/reactivity/Atom";

export type ResumeSource = (resume: () => void) => () => void;

type ResumeEvent = "online" | "visibilitychange";

export interface ResumeWindow {
	readonly addEventListener: (type: ResumeEvent, listener: () => void) => void;
	readonly document: { readonly visibilityState: string };
	readonly removeEventListener: (type: ResumeEvent, listener: () => void) => void;
}

export interface ResumeOptions {
	readonly native?: ResumeSource;
	readonly window?: ResumeWindow;
}

const whileVisible =
	(target: ResumeWindow, type: ResumeEvent): ResumeSource =>
	(resume) => {
		const visible = () => {
			if (target.document.visibilityState === "visible") resume();
		};
		target.addEventListener(type, visible);
		return () => target.removeEventListener(type, visible);
	};

export const resumeSignal = ({ window, native }: ResumeOptions): Atom.Atom<number> => {
	const browser = window === undefined ? [] : [whileVisible(window, "visibilitychange"), whileVisible(window, "online")];
	const sources = native === undefined ? browser : [...browser, native];
	return Atom.readable((get) => {
		let count = 0;
		const resume = () => get.setSelf(++count);
		for (const source of sources) get.addFinalizer(source(resume));
		return count;
	});
};
