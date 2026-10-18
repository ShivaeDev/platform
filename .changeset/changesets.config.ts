import { defineConfig } from "@shivaedev/changesets/config.ts";
import { releasePlatformHook } from "#release/platformHook.ts";

export default defineConfig({ hooks: [releasePlatformHook] });
