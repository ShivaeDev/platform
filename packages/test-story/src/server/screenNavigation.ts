import * as Effect from "effect/Effect";

export function screenNavigation(root: () => HTMLElement, prefix: string) {
	return Effect.suspend(() => {
		const location = root().ownerDocument.location;
		const original = Object.getOwnPropertyDescriptor(location, "href");
		const descriptor = original ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(location), "href");
		const wait = Effect.callback<void>((resume) => {
			function changed() {
				if (location.href.startsWith(prefix)) {
					resume(Effect.void);
				}
			}
			// happy-dom's detached window changes location without emitting a navigation event.
			Object.defineProperty(location, "href", {
				configurable: true,
				get: () => descriptor?.get?.call(location),
				set: (value: string) => {
					descriptor?.set?.call(location, value);
					changed();
				},
			});
			changed();
		});
		return wait.pipe(
			Effect.ensuring(
				Effect.sync(() => {
					if (original) {
						Object.defineProperty(location, "href", original);
					} else {
						Reflect.deleteProperty(location, "href");
					}
				}),
			),
		);
	});
}
