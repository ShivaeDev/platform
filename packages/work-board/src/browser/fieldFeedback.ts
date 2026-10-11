import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import type { Fields, Form, Name } from "@shivaedev/effect-form/shape.ts";

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function fieldFeedback<TFields extends Fields, A, E, TRuntimeError>(
	form: Form<TFields, A, E, TRuntimeError>,
	owner: ReturnType<typeof formOwner>,
	fields: ReadonlyArray<{ readonly name: Name<TFields>; readonly control?: Control | undefined }>,
	paths: ReadonlyArray<{ readonly path: readonly [Name<TFields>, ...PropertyKey[]]; readonly control: Control }> = [],
) {
	const releases = fields.map(({ name, control }) =>
		owner.registry.subscribe(form.error(name), (message) => control?.setCustomValidity(message ?? ""), { immediate: true }),
	);
	for (const { path, control } of paths) {
		releases.push(owner.registry.subscribe(form.errorAt(path), (message) => control.setCustomValidity(message ?? ""), { immediate: true }));
	}
	owner.signal.addEventListener(
		"abort",
		() => {
			for (const release of releases) {
				release();
			}
		},
		{ once: true },
	);
	return () => {
		for (const { name } of fields) {
			form.blur(name);
		}
		return fields.every(({ name }) => owner.registry.get(form.error(name)) === undefined);
	};
}

export function formOwner(dom: HTMLFormElement) {
	const controller = new AbortController();
	const registry = AtomRegistry.make();
	function release() {
		controller.abort();
		registry.dispose();
		delete dom.dataset.bound;
		document.removeEventListener("board-page", unmounted);
		window.removeEventListener("pagehide", release);
	}
	function unmounted() {
		if (!dom.isConnected) {
			release();
		}
	}
	document.addEventListener("board-page", unmounted);
	window.addEventListener("pagehide", release);
	return { registry, signal: controller.signal };
}
