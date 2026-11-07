import { Effect } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";

export const initialize = Effect.map(SessionUser, (user) => ({ capturedRole: user.role ?? "member" }));
