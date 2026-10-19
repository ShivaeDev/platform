import { act } from "react";
import type { ScreenEngine } from "./screenEngine.ts";

export function sessionTransportActions(engine: ScreenEngine, tell: (line: string) => void) {
	function boundary() {
		if (!engine.sessionTransport) {
			throw new Error("No session transport boundary was prepared");
		}
		return engine.sessionTransport;
	}
	return {
		editSessionFile: (path: string, source: string) => {
			tell(`an outside editor writes ${path}`);
			if (!engine.session) {
				throw new Error("The session has not opened");
			}
			engine.session.notes.write(path, source);
		},
		pauseCommand: () => {
			tell("the next native command waits before reaching the server");
			const transport = boundary();
			transport.gate = new Promise<void>((resolve) => {
				transport.release = resolve;
			});
		},
		readPageBesideDaemon: async () => {
			tell("the page reads the Board while the Board server reads the Fleet daemon");
			if (!engine.session || engine.sessionFleetPort === undefined) {
				throw new Error("The session has no story Fleet daemon");
			}
			const origin = engine.session.environment.location.origin;
			let outcome = "unsettled";
			await act(async () => {
				const page = fetch(`${origin}/`);
				await fetch(`http://127.0.0.1:${engine.sessionFleetPort}/`).catch(() => undefined);
				outcome = await page.then(
					(response) => (response.ok ? "read" : `answered ${response.status}`),
					(error: unknown) => String(error),
				);
			});
			return outcome;
		},
		releaseCommand: async () => {
			tell("the native command reaches the server");
			const transport = boundary();
			if (!transport.release) {
				throw new Error("No native command is paused");
			}
			await act(() =>
				Promise.resolve().then(() => {
					transport.release?.();
					transport.gate = undefined;
				}),
			);
		},
		sessionCommands: () => [...boundary().commands],
		setSessionOffline: (offline: boolean) => {
			tell(`native command delivery becomes ${offline ? "unavailable" : "available"}`);
			boundary().offline = offline;
		},
		setSessionServer: (answering: boolean) => {
			tell(answering ? "the Board server answers again" : "the Board server stops answering");
			engine.serverStopped = !answering;
		},
	};
}
