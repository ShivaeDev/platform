export function reactRendering() {
	return Promise.all([import("@effect/atom-react"), import("effect/reactivity/AtomRegistry"), import("react-dom/client"), import("react")]);
}
