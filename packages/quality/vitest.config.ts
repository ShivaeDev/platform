import { defineConfig } from "vitest/config";
import { testProjects } from "./src/vitest.ts";

export default defineConfig({ test: testProjects() });
