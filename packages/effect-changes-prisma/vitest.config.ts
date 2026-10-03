import { testProjects } from "@shivaedev/quality/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({ test: testProjects() });
