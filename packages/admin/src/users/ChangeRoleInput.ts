export interface ChangeRoleInput<TRole extends string = string> {
	readonly role: TRole;
	readonly userId: string;
}
