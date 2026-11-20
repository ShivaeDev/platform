import { Context } from "effect";

// A success schema generated from a TypeScript type carries no annotation, so it can neither mark a name sensitive nor declare one public.
export const GeneratedSuccess = Context.Reference<boolean>("@shivaedev/errors/GeneratedSuccess", { defaultValue: () => false });
