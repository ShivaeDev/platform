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
