import type * as Atom from "effect/reactivity/Atom";
import type { ResumeWindow } from "@shivaedev/contract/resume.ts";
import { browserClient } from "#adapters/browserClient.ts";

type BrowserEnvironment = ResumeWindow & {
	readonly runtime?: Atom.RuntimeFactory;
	readonly location: { readonly origin: string };
	readonly addEventListener: (type: "pagehide", listener: () => void) => void;
	readonly removeEventListener: (type: "pagehide", listener: () => void) => void;
};
const sessions = new WeakMap<BrowserEnvironment, ReturnType<typeof browserClient>>();
export function session(environment: BrowserEnvironment) {
	let client = sessions.get(environment);
	if (client === undefined) {
		client = browserClient(environment.location.origin, { ...(environment.runtime ? { runtime: environment.runtime } : {}), window: environment });
		sessions.set(environment, client);
		const owned = client;
		function dispose() {
			owned.registry.dispose();
			if (sessions.get(environment) === owned) {
				sessions.delete(environment);
			}
			environment.removeEventListener("pagehide", dispose);
		}
		environment.addEventListener("pagehide", dispose);
	}
	return client;
}
