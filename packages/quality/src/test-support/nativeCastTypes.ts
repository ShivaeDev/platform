import { createRequire } from "node:module";
import { dirname } from "node:path";
import { repositoryLinks } from "./ruleStory.ts";

export const nativeCastTypes = repositoryLinks("node_modules/effect", dirname(createRequire(import.meta.url).resolve("effect/package.json")));
