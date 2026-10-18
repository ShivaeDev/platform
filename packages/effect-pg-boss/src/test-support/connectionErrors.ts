import { boss } from "#test/boss.ts";
import { scriptedClient } from "#test/scriptedClient.ts";

type Phase = "start" | "stop" | "failed start" | "failed stop" | "pool kept open" | "failed startup cleanup";
export const connectionFailure = Object.assign(new Error("terminating connection due to administrator command"), { code: "57P01" });

export function connectionErrors(phase: Phase) {
	return boss.trait("client", `connection errors during ${phase}`, (state) => {
		const events = state.events;
		state.factory = () =>
			scriptedClient({
				off: (event, listener) => events.off(event, listener),
				on: (event, listener) => events.on(event, listener),
				start: () => {
					if (phase === "start" || phase === "failed start") {
						events.emit("error", connectionFailure);
					}
					if (phase === "failed start" || phase === "failed startup cleanup") {
						return Promise.reject(connectionFailure);
					}
					return Promise.resolve();
				},
				stop: () => {
					if (phase === "stop") {
						events.emit("error", connectionFailure);
					}
					if (phase === "failed stop" || phase === "failed startup cleanup") {
						return Promise.reject(connectionFailure);
					}
					return Promise.resolve();
				},
			});
	});
}
