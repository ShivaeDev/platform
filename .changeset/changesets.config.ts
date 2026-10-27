import { defineConfig } from "@shivaedev/releases/config.ts";
import { releasePlatformHook } from "#release/platformHook.ts";

export default defineConfig({ hooks: [releasePlatformHook] });
