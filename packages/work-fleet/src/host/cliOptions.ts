import * as Flag from "effect/cli/Flag";
import * as Option from "effect/Option";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { loadHost } from "#host/configFile.ts";

const { DAEMON_PORT } = diagnosticsApi;

export const board = Flag.Directory("board").pipe(Flag.withDefault(".work"), Flag.withDescription("Board folder holding fleet.config.json"));
export const config = Flag.File("config").pipe(Flag.optional, Flag.withDescription("Host configuration instead of <board>/fleet.config.json"));

export function host(folder: string, file: Option.Option<string>) {
	return loadHost(folder, Option.getOrUndefined(file));
}

export const port = Flag.Int("port").pipe(Flag.withDefault(DAEMON_PORT), Flag.withDescription("Local Fleet daemon port"));
