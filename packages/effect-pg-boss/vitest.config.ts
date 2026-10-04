import { defineConfig } from "vitest/config";
import { testProjects } from "@shivaedev/quality/vitest";

export default defineConfig({ test: testProjects() });
