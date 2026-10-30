export function deadlock(): Error & { readonly code: string } {
	return Object.assign(new Error("deadlock detected"), { code: "40P01" });
}
