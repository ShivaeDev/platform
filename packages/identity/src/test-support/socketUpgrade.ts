import * as NodeWs from "@effect/platform-node/NodeWS";
import { Effect } from "effect";

export function socketUpgrade(url: string, origin: string) {
	return Effect.callback<string>((resume) => {
		const socket = new NodeWs.WebSocket(url, { origin });
		socket.on("error", (error) => resume(Effect.succeed(`failed: ${error.message}`)));
		socket.once("open", () => {
			socket.close();
			resume(Effect.succeed("opened"));
		});
		socket.once("unexpected-response", (request, response) => {
			request.destroy();
			resume(Effect.succeed(`refused with HTTP ${response.statusCode}`));
		});
		return Effect.sync(() => socket.terminate());
	});
}
