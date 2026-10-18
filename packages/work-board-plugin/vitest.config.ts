import { defineConfig } from "vitest/config";
import { testProjects } from "@shivaedev/quality/testProjects.ts";

export default defineConfig({ test: testProjects() });
