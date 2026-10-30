import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appendSupervisorLog } from "#host/appendSupervisorLog.ts";
import { logSupervisor } from "#host/supervisedProcess.ts";

export const supervisorLog = storyKit({
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "fleet-log-" });
		return { fs, log: `${root}/.work-up.log`, root };
	},
	layer: NodeServices.layer,
	name: "Supervisor log",
	stages: [],
	verbs: ({ fs, log, root }) => ({
		append: (text: string) => appendSupervisorLog(log, text),
		files: () => fs.readDirectory(root).pipe(Effect.map((files) => files.toSorted())),
		read: (suffix = "") => fs.readFileString(`${log}${suffix}`),
		seed: (text: string, suffix = "") => fs.writeFileString(`${log}${suffix}`, text),
		supervisor: (message: string) => logSupervisor(log, message),
	}),
});
