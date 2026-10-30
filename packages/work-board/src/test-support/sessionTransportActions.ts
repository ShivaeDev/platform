import { act } from "react";
import { session } from "#client/session.ts";
import { waitFor } from "#test/live.ts";
import type { ScreenEngine } from "#test/screenEngine.ts";

export function sessionTransportActions(engine: ScreenEngine, tell: (line: string) => void) {
	async function connected() {
		if (!engine.session) {
			throw new Error("The session has not opened");
		}
		const client = session(engine.session.environment);
		await waitFor(() => {
			if (client.registry.get(client.updates.status).connection !== "live") {
				throw new Error("The session is reconnecting");
			}
		});
	}
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
		setSessionOffline: async (offline: boolean) => {
			tell(`native command delivery becomes ${offline ? "unavailable" : "available"}`);
			await act(async () => {
				boundary().offline = offline;
				if (!offline) {
					await connected();
				}
			});
		},
		setSessionServer: async (answering: boolean) => {
			tell(answering ? "the Board server answers again" : "the Board server stops answering");
			await act(async () => {
				engine.serverStopped = !answering;
				if (answering) {
					await connected();
				} else {
					engine.sessionDisconnect?.();
				}
			});
		},
	};
}
