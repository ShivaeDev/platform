import { Context } from "effect";

export const UnixSocketRequest = Context.Reference<boolean>("@shivaedev/server/UnixSocketRequest", { defaultValue: () => false });
