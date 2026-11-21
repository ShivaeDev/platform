import { Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";

export const adminTasks = collection("admin_tasks", Schema.String);
