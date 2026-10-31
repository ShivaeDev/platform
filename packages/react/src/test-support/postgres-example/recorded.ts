export function recorded<T>() {
	const items: T[] = [];
	const waiting = new Set<{ readonly check: () => void; readonly reject: (error: Error) => void }>();
	let failure: Error | undefined;
	return {
		fail(error: Error) {
			failure ??= error;
			for (const waiter of [...waiting]) {
				waiting.delete(waiter);
				waiter.reject(error);
			}
		},
		items,
		push(item: T) {
			items.push(item);
			for (const waiter of [...waiting]) {
				waiter.check();
			}
		},
		when(ready: (items: readonly T[]) => boolean) {
			return new Promise<void>((resolve, reject) => {
				if (failure) {
					reject(failure);
					return;
				}
				const waiter = {
					check: () => {
						if (ready(items)) {
							waiting.delete(waiter);
							resolve();
						}
					},
					reject,
				};
				waiting.add(waiter);
				waiter.check();
			});
		},
	};
}
