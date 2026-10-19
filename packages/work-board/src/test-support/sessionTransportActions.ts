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
	};
}
