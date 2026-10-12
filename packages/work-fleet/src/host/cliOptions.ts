import * as Option from "effect/Option";
import * as Flag from "effect/unstable/cli/Flag";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/integration/diagnostics.ts";
import { loadHost } from "#host/config.ts";

const { DAEMON_PORT } = diagnosticsApi;

export const board = Flag.directory("board").pipe(Flag.withDefault(".work"), Flag.withDescription("Board folder holding fleet.config.json"));
export const config = Flag.file("config").pipe(Flag.optional, Flag.withDescription("Host configuration instead of <board>/fleet.config.json"));

export function host(folder: string, file: Option.Option<string>) {
	return loadHost(folder, Option.getOrUndefined(file));
}

export const port = Flag.integer("port").pipe(Flag.withDefault(DAEMON_PORT), Flag.withDescription("Local Fleet daemon port"));
