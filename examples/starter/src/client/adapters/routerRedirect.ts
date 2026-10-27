import { redirect } from "@tanstack/react-router";

export function routerRedirect(href: string): never {
	throw redirect({ href });
}
