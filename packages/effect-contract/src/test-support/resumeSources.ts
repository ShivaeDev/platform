import type { ResumeWindow } from "#resume.ts";

export function syntheticWindow() {
	const target = new EventTarget();
	const listeners = new Set<() => void>();
	const document: { visibilityState: string } = { visibilityState: "visible" };
	const window: ResumeWindow = {
		addEventListener: (type, listener) => {
			listeners.add(listener);
			target.addEventListener(type, listener);
		},
		document,
		removeEventListener: (type, listener) => {
			listeners.delete(listener);
			target.removeEventListener(type, listener);
		},
	};
	return {
		fire: (type: "online" | "visibilitychange", visibility = "visible") => {
			document.visibilityState = visibility;
			target.dispatchEvent(new Event(type));
		},
		listeners,
		window,
	};
}

export function syntheticNative() {
	const listeners = new Set<() => void>();
	return {
		listeners,
		resume: () => {
			for (const listener of listeners) {
				listener();
			}
		},
		source: (resume: () => void) => {
			listeners.add(resume);
			return () => listeners.delete(resume);
		},
	};
}
