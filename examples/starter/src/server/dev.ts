import { runDevelopment } from "@shivaedev/platform/server/development.ts";

runDevelopment({ conditions: ["source"], server: "src/server/server.ts", worker: "src/server/worker.ts" });
