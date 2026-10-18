import { engineScenario } from "#test/engineScenario.ts";
import { missingTurnTransport } from "#test/missingTurnTransport.ts";

export function workerTurnDisappears(lostAcknowledgement: boolean) {
	return engineScenario("a worker turn disappears with an optional lost acknowledgement", () => {
		const missing = missingTurnTransport();
		return { context: { missing }, options: { decorateTransport: missing.decorate, lostAcknowledgement } };
	});
}
