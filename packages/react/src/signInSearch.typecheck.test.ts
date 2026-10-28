import { signInSearch } from "#signInSearch.ts";

const location = { href: "/notes/first?tab=history", state: { navigation: "initial" } };
export const search: { readonly returnTo?: string } = signInSearch(location);
