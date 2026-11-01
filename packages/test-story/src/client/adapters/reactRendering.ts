export function reactRendering(): Promise<
	[typeof import("@effect/atom-react"), typeof import("effect/reactivity/AtomRegistry"), typeof import("react-dom/client"), typeof import("react")]
> {
	return Promise.all([import("@effect/atom-react"), import("effect/reactivity/AtomRegistry"), import("react-dom/client"), import("react")]);
}
