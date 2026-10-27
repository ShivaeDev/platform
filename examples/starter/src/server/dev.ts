import { runDevelopment } from "@shivaedev/server/development.ts";

runDevelopment({ conditions: ["source"], server: "src/server/server.ts", worker: "src/server/worker.ts" });
