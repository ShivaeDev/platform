import type { Vitest } from "vitest/node";

export type Files = ReturnType<Vitest["state"]["getFiles"]>;
export type Task = Files[number]["tasks"][number];
