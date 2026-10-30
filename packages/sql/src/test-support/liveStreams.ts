import { Effect } from "effect";

export function liveStreams() {
	const open = new Set<string>();
	const resyncs = new Map<string, number>();
	return {
		close: (name: string) => Effect.sync(() => open.delete(name)),
		open: (name: string) =>
			Effect.sync(() => {
				open.add(name);
				resyncs.set(name, 0);
			}),
		resync: Effect.sync(() => {
			for (const name of open) {
				resyncs.set(name, (resyncs.get(name) ?? 0) + 1);
			}
			return open.size;
		}),
		resyncs: () => Object.fromEntries(resyncs),
	};
}
