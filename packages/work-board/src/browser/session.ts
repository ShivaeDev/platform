import type { ResumeWindow } from "@shivaedev/effect-contract/resume.ts";
import { browserClient } from "./client.ts";

type BrowserEnvironment = ResumeWindow & {
	readonly location: { readonly origin: string };
	readonly addEventListener: (type: "pagehide", listener: () => void) => void;
	readonly removeEventListener: (type: "pagehide", listener: () => void) => void;
};
const sessions = new WeakMap<BrowserEnvironment, ReturnType<typeof browserClient>>();
export function session(environment: BrowserEnvironment) {
	let client = sessions.get(environment);
	if (client === undefined) {
		client = browserClient(environment.location.origin, { window: environment });
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
