export function snapshotObservation() {
	const subscribed = Promise.withResolvers<void>();
	let snapshots = 0;
	const waiters = new Set<() => void>();
	return {
		nextSnapshot(previous: number) {
			return new Promise<void>((resolve) => {
				function ready() {
					if (snapshots > previous) {
						waiters.delete(ready);
						resolve();
					}
				}
				waiters.add(ready);
				ready();
			});
		},
		onSnapshot() {
			snapshots += 1;
			subscribed.resolve();
			for (const ready of waiters) {
				ready();
			}
		},
		snapshotCount: () => snapshots,
		subscribed: subscribed.promise,
	};
}
