import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";

export function screenMutations(root: HTMLElement, changes: Queue.Queue<void>) {
	return Effect.acquireRelease(
		Effect.sync(() => {
			const observer = new (root.ownerDocument.defaultView ?? globalThis).MutationObserver(() => Queue.offerUnsafe(changes, undefined));
			// Root getters can follow navigation, and visibility can change on an ancestor.
			observer.observe(root.ownerDocument, { attributes: true, characterData: true, childList: true, subtree: true });
			observer.observe(root, { attributes: true, characterData: true, childList: true, subtree: true });
			return observer;
		}),
		(observer) => Effect.sync(() => observer.disconnect()),
	);
}
