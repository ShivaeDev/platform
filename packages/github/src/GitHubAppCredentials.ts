import { Context } from "effect";
import type { AppCredentials } from "#appJwt.ts";

export const GitHubAppCredentials = Context.Service<{ readonly credentials: AppCredentials }>("@shivaedev/github/AppCredentials");
