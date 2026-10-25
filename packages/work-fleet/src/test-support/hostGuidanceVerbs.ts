import { Effect, type FileSystem, type Path } from "effect";
import { resolveHost } from "#host/config.ts";
import { hostGuidance } from "#host/guidance.ts";
import { configuredPrompt } from "#test/configuredPrompt.ts";

export function hostGuidanceVerbs(state: { fs: FileSystem.FileSystem; path: Path.Path; root: string }, tell: (line: string) => void) {
	const file = state.path.join(state.root, "guidance.txt");
	return {
		cachedGuidance: (role: "worker" | "reviewer") => {
			tell(`load the host's cached ${role} guidance reader`);
			return hostGuidance(
				resolveHost(state.root, {
					provider: "local",
					worker: { branchPrefix: "test/", sharedEnvironment: "/synthetic/env.sh", [`${role}Guidance`]: { file: "guidance.txt" } },
				}),
				role,
			);
		},
		prompt: (...args: Parameters<typeof configuredPrompt>) => {
			tell(`load the configured ${args[0]} prompt`);
			return configuredPrompt(...args);
		},
		removeGuidance: () => {
			tell("remove the configured guidance file");
			return state.fs.remove(file);
		},
		touchGuidance: (modifiedAt: number) => {
			tell(`touch guidance at ${modifiedAt}`);
			return state.fs.utimes(file, new Date(modifiedAt), new Date(modifiedAt));
		},
		writeGuidance: (text: string, modifiedAt: number) => {
			tell(`write guidance modified at ${modifiedAt}`);
			return state.fs.writeFileString(file, text).pipe(Effect.andThen(state.fs.utimes(file, new Date(modifiedAt), new Date(modifiedAt))));
		},
	};
}
