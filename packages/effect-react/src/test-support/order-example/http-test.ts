import { listenServer } from "./listenServer.ts";
import { makeWebHandler } from "./makeWebHandler.ts";

export function startOrderServer(options: Parameters<typeof makeWebHandler>[0]) {
	return listenServer(makeWebHandler(options));
}
