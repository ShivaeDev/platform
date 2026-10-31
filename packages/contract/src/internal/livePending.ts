import type { Duration } from "effect";

export function livePending(start: (window: Duration.Input) => void, stop: () => void) {
	const pending = new Set<string>();
	let scheduled = false;
	return {
		add(keys: readonly string[], window: Duration.Input) {
			for (const key of keys) {
				pending.add(key);
			}
			if (!scheduled) {
				scheduled = true;
				start(window);
			}
		},
		clear() {
			stop();
			scheduled = false;
			pending.clear();
		},
		take() {
			const queued = [...pending];
			scheduled = false;
			pending.clear();
			return queued;
		},
	};
}
