import { Layer } from "effect";
import { GitHub } from "#GitHub.ts";
import { GitHubHttp } from "#GitHubHttp.ts";
import { StateFile } from "#StateFile.ts";
import { Watcher } from "#Watcher.ts";

export const services = Watcher.layer.pipe(Layer.provide(Layer.mergeAll(StateFile.layer, GitHub.layer.pipe(Layer.provide(GitHubHttp.layer)))));
