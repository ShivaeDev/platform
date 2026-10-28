import { linkOptions } from "@tanstack/react-router";

export const signIn = linkOptions({ search: { returnTo: "/notes/1?tab=history" }, to: "/sign-in" });
// @ts-expect-error Return targets are strings.
export const invalidSearch = linkOptions({ search: { returnTo: 123 }, to: "/sign-in" });
// @ts-expect-error Only application route paths are valid.
export const invalidPath = linkOptions({ to: "/missing-route" });
