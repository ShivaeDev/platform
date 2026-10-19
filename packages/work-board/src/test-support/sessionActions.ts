import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { session } from "#client/session.ts";
import type { ScreenEngine } from "./screenEngine.ts";

export function sessionActions(engine: ScreenEngine, tell: (line: string) => void) {
	function current() {
		if (!engine.session) {
			throw new Error("The live session has not opened");
		}
		return engine.session;
	}
	return {
		readSession: () => {
			tell("the reader checks the active session");
			return session(current().environment);
		},
		readSessionDiagnostics: async () => {
			tell("the reader reads diagnostics through the active native session");
			const client = session(current().environment);
			return await act(() => client.run(client.api.diagnostics.run(undefined)));
		},
		readSessionFiles: (namespace: "responses" | "handoffs") => {
			tell(`the reader inspects recorded ${namespace}`);
			const directory = join(current().notes.root, namespace);
			if (!existsSync(directory)) {
				return [];
			}
			return readdirSync(directory)
				.filter((file) => file.endsWith(".md"))
				.map((file) => readFileSync(join(directory, file), "utf8"));
		},
		readSessionNavigation: async () => {
			tell("the reader reads navigation through the active native session");
			const client = session(current().environment);
			return await act(() => client.run(client.api.navigation.run({ current: "" })));
		},
		restoreSession: () => {
			tell("the browser restores the page from its page cache");
			act(() => {
				window.dispatchEvent(new Event("pagehide"));
				session(current().environment);
				window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
			});
		},
	};
}
