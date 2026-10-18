import * as Flag from "effect/cli/Flag";
import * as Option from "effect/Option";
import { loadHost } from "#host/configFile.ts";
import { readDaemonPort } from "#host/daemonPort.ts";

export const board = Flag.Directory("board").pipe(
	Flag.withDefault(".work"),
	Flag.withDescription("Board folder holding Fleet configuration and daemon port"),
);
export const config = Flag.File("config").pipe(Flag.optional, Flag.withDescription("Host configuration instead of <board>/fleet.config.json"));

export function host(folder: string, file: Option.Option<string>) {
	return loadHost(folder, Option.getOrUndefined(file));
}

export const port = Flag.Int("port").pipe(Flag.optional, Flag.withDescription("Override the local Fleet daemon port"));

export function clientPort(input: { readonly board: string; readonly port: Option.Option<number> }) {
	return readDaemonPort(input.board, Option.getOrUndefined(input.port));
}
