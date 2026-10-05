import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { liveClient } from "./client.ts";

const client = liveClient(location.origin, { window });
const registry = AtomRegistry.make();
const releases: Array<() => void> = [];
function output(id: string, body: string) {
	const target = document.getElementById(id);
	if (target !== null) {
		target.textContent = body;
	}
}
for (const id of ["one", "two"]) {
	const atom = client.api.get.query({ id });
	releases.push(
		registry.subscribe(
			atom,
			(value) =>
				output(
					id,
					`${AsyncResult.getOrElse(value, () => undefined)?.body ?? "Loading"}${AsyncResult.isFailure(value) ? " (read failed)" : ""}${value.waiting ? " (refreshing)" : ""}`,
				),
			{ immediate: true },
		),
	);
}
releases.push(
	registry.subscribe(
		client.api.list.query(),
		(value) =>
			output(
				"list",
				AsyncResult.getOrElse(value, () => [])
					.map(({ body }) => body)
					.join(", "),
			),
		{ immediate: true },
	),
);
releases.push(
	registry.subscribe(
		Atom.make((get) => ({ ...get(client.status), isPaused: get(client.paused) })),
		(state) =>
			output(
				"status",
				`${state.connection}; ${state.isPaused ? "paused" : "reading"}; pending ${state.pending}; ${state.needsResync ? "needs resync" : "invalidation issued"}${Option.isSome(state.failure) ? "; stream failed" : ""}`,
			),
		{ immediate: true },
	),
);
releases.push(registry.mount(client.connection));
releases.push(registry.subscribe(client.signal, (count) => output("resume-events", String(count)), { immediate: true }));
document.getElementById("pause")?.addEventListener("click", () => registry.set(client.paused, true));
document.getElementById("resume")?.addEventListener("click", () => registry.set(client.paused, false));
window.addEventListener(
	"pagehide",
	() => {
		for (const release of releases) {
			release();
		}
		registry.dispose();
	},
	{ once: true },
);
