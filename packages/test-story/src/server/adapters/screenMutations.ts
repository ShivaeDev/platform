import * as Effect from "effect/Effect";

export function screenMutations(root: HTMLElement, changed: () => void) {
	return Effect.acquireRelease(
		Effect.sync(() => {
			const observer = new MutationObserver(changed);
			// Root getters can follow navigation, and visibility can change on an ancestor.
			observer.observe(root.ownerDocument, { attributes: true, characterData: true, childList: true, subtree: true });
			observer.observe(root, { attributes: true, characterData: true, childList: true, subtree: true });
			return observer;
		}),
		(observer) => Effect.sync(() => observer.disconnect()),
	);
}
