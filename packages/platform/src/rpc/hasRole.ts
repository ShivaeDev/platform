export function hasRole(user: { readonly role?: string | null | undefined }, role: string): boolean {
	return user.role?.split(",").includes(role) ?? false;
}
