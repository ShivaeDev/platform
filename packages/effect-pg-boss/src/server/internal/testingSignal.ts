import { Effect } from "effect";

export function testingSignal() {
	let revision = 0;
	const listeners = new Set<(revision: number) => void>();
	return {
		changed() {
			revision += 1;
			for (const listener of listeners) {
				listener(revision);
			}
			listeners.clear();
		},
		revision: Effect.sync(() => revision),
		waitForChange: (after: number): Effect.Effect<number> =>
			Effect.callback((resume) => {
				if (revision !== after) {
					resume(Effect.succeed(revision));
					return;
				}
				function listener(current: number) {
					resume(Effect.succeed(current));
				}
				listeners.add(listener);
				return Effect.sync(() => listeners.delete(listener));
			}),
	};
}
