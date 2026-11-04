import * as Atom from "effect/reactivity/Atom";

export const pageHidden = Atom.make((get) => {
	if (typeof document === "undefined") {
		return false;
	}
	function changed() {
		get.setSelf(document.visibilityState === "hidden");
	}
	document.addEventListener("visibilitychange", changed);
	get.addFinalizer(() => document.removeEventListener("visibilitychange", changed));
	return document.visibilityState === "hidden";
}).pipe(Atom.setIdleTTL(0));
