import { Effect } from "effect";
import { hostProcess } from "#testing/hostProcess.ts";

export function startHost(port = 0) {
	return hostProcess({
		args: [String(port)],
		execArgv: ["--conditions=source"],
		module: new URL("./process.ts", import.meta.url),
	}).pipe(Effect.map((host) => ({ ...host, port: Number(new URL(host.url).port) })));
}
