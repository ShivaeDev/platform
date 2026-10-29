import { NodeWS } from "@effect/platform-node/NodeSocket";
import { Effect } from "effect";

export function upgrade(url: string, headers: Readonly<Record<string, string>>) {
	return Effect.promise(
		() =>
			new Promise<number | undefined>((resolve, reject) => {
				const socket = new NodeWS.WebSocket(url.replace(/^http/u, "ws"), { headers });
				socket.once("error", reject);
				socket.once("open", () => {
					socket.close();
				});
				socket.once("upgrade", (response) => resolve(response.statusCode));
				socket.once("unexpected-response", (_request, response) => {
					response.resume();
					resolve(response.statusCode);
					socket.terminate();
				});
			}),
	);
}
