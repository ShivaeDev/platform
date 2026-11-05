import type { ResumeOptions, ResumeSource, ResumeWindow } from "#resume.ts";

function whileVisible(target: ResumeWindow, type: "online" | "visibilitychange" | "pageshow"): ResumeSource {
	return (resume) => {
		function visible() {
			if (target.document.visibilityState === "visible") {
				resume();
			}
		}
		target.addEventListener(type, visible);
		return () => target.removeEventListener(type, visible);
	};
}

export function resumeSources({ window, native }: ResumeOptions): readonly ResumeSource[] {
	const browser =
		window === undefined ? [] : [whileVisible(window, "visibilitychange"), whileVisible(window, "online"), whileVisible(window, "pageshow")];
	return native === undefined ? browser : [...browser, native];
}
