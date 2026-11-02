import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { remoteDeclaresOversizedBody, remoteSends, stalledBody } from "#test/http-client/bodies.ts";
import { httpClient, usingClient } from "#test/http-client/story.ts";

for (const transport of ["fetch", "node"] as const) {
	httpClient.it(
		`${transport} reads use the selected client and release the completed body scope`,
		[usingClient(transport), remoteSends("paper")],
		function* ({ bodyScope, clientsUsed, readText }) {
			yield* readText(5);

			yield* outcomes([
				["client used", clientsUsed, [`${transport} GET /body`]],
				["body scope", bodyScope, "released"],
			]);
		},
	);
	httpClient.it(
		`${transport} releases an oversized response's stream scope and abandons its withheld body`,
		[usingClient(transport), remoteDeclaresOversizedBody],
		function* ({ abandonedRequest, bodyScope, readBytes }) {
			yield* readBytes(10);

			yield* outcomes([
				["body scope", bodyScope, "released"],
				["abandoned request", abandonedRequest, "GET /body unanswered"],
			]);
		},
	);
	httpClient.it(
		`interrupting a ${transport} body read releases its stream scope and abandons the request`,
		[usingClient(transport), stalledBody],
		function* ({ abandonedRequest, bodyScope, interruptReading, interruption, readPaper, startReadingBody }) {
			yield* readPaper();
			yield* startReadingBody();
			yield* outcomes([
				["body scope before interruption", bodyScope, "open"],
				["read before interruption", interruption, "running"],
			]);

			yield* interruptReading();

			yield* outcomes([
				["body scope", bodyScope, "released"],
				["read", interruption, "interrupted"],
				["abandoned request", abandonedRequest, "GET /body unanswered"],
			]);
		},
	);
}
