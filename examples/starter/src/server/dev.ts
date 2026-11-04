import { runDevelopment } from "@shivaedev/server/development.ts";

runDevelopment({ conditions: ["@shivaedev/source"], server: "src/server/server.ts", worker: "src/server/worker.ts" });
