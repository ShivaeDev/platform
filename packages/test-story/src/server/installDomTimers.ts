export function installDomTimers(global: typeof globalThis): () => void {
	const original = {
		clearInterval: global.clearInterval,
		clearTimeout: global.clearTimeout,
		setInterval: global.setInterval,
		setTimeout: global.setTimeout,
	};
	const timeouts = new Set<Parameters<typeof original.clearTimeout>[0]>();
	const intervals = new Set<Parameters<typeof original.clearInterval>[0]>();
	const timers = {
		clearInterval(handle: Parameters<typeof original.clearInterval>[0]) {
			intervals.delete(handle);
			original.clearInterval(handle);
		},
		clearTimeout(handle: Parameters<typeof original.clearTimeout>[0]) {
			timeouts.delete(handle);
			original.clearTimeout(handle);
		},
		setInterval(callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) {
			const handle = original.setInterval(callback, delay, ...args);
			intervals.add(handle);
			return handle;
		},
		setTimeout(callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) {
			const handle = original.setTimeout(() => {
				timeouts.delete(handle);
				callback.apply(handle, args);
			}, delay);
			timeouts.add(handle);
			return handle;
		},
	};
	const descriptors = new Map(Object.keys(timers).map((name) => [name, Object.getOwnPropertyDescriptor(global, name)]));
	for (const [name, value] of Object.entries(timers)) {
		Object.defineProperty(global, name, { configurable: true, value, writable: true });
	}
	return () => {
		for (const handle of timeouts) {
			original.clearTimeout(handle);
		}
		for (const handle of intervals) {
			original.clearInterval(handle);
		}
		for (const [name, descriptor] of descriptors) {
			if (descriptor) {
				Object.defineProperty(global, name, descriptor);
			} else {
				Reflect.deleteProperty(global, name);
			}
		}
	};
}
