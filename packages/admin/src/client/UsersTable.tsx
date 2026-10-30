import { DateTime } from "effect";
import type { ReactNode } from "react";
import type { UsersList } from "#users/page.ts";
import type { AppUser, ChangeRoleInput } from "#users/roles.ts";

interface RoleControls<TRole extends string> {
	readonly dispatch: (input: ChangeRoleInput<TRole>) => void;
	readonly pending: boolean;
	readonly roles: readonly TRole[];
}

function UserRole<TRole extends string>({
	user,
	canChangeRoles,
	roles,
	pending,
	dispatch,
}: RoleControls<TRole> & {
	readonly user: typeof AppUser.Type;
	readonly canChangeRoles: boolean;
}) {
	if (!canChangeRoles) {
		return user.role;
	}
	return (
		<select
			aria-label={`Role for ${user.email}`}
			className="bg-background max-w-full min-w-0 rounded-md border p-2 sm:max-w-none"
			disabled={pending}
			onChange={(event) => {
				const role = roles.find((candidate) => candidate === event.target.value);
				if (role !== undefined) {
					dispatch({ role, userId: user.id });
				}
			}}
			value={user.role}
		>
			{roles.map((role) => (
				<option key={role} value={role}>
					{role}
				</option>
			))}
		</select>
	);
}

function UserRow<TRole extends string>({
	user,
	canChangeRoles,
	...controls
}: RoleControls<TRole> & { readonly user: typeof AppUser.Type; readonly canChangeRoles: boolean }) {
	return (
		<tr className="block min-w-0 rounded-md border sm:table-row sm:rounded-none sm:border-0 sm:border-b">
			<UserCell label="Name">{user.name}</UserCell>
			<UserCell label="Email">{user.email}</UserCell>
			<UserCell label="Role">
				<UserRole {...controls} canChangeRoles={canChangeRoles} user={user} />
			</UserCell>
			<UserCell label="Signed up">
				<time className="sm:whitespace-nowrap" dateTime={DateTime.formatIso(user.createdAt)}>
					{DateTime.formatIso(user.createdAt)}
				</time>
			</UserCell>
		</tr>
	);
}
function UserCell({ label, children }: { readonly label: string; readonly children: ReactNode }) {
	return (
		<td className="block min-w-0 p-3 wrap-anywhere sm:table-cell sm:wrap-normal">
			<span className="block font-medium sm:hidden">{label}</span>
			<div>{children}</div>
		</td>
	);
}

function UserRows<TRole extends string>({ data, ...controls }: RoleControls<TRole> & { readonly data: typeof UsersList.Type }) {
	return (
		<div className="sm:overflow-x-auto sm:rounded-md sm:border">
			<table className="block w-full text-left text-sm sm:table">
				<caption className="sr-only">App users and roles</caption>
				<thead className="bg-muted hidden sm:table-header-group">
					<UserHeaders />
				</thead>
				<tbody className="grid gap-4 sm:table-row-group">
					{data.users.map((user) => (
						<UserRow {...controls} canChangeRoles={data.canChangeRoles} key={user.id} user={user} />
					))}
				</tbody>
			</table>
		</div>
	);
}
export function UsersTable<TRole extends string>({ data, ...controls }: RoleControls<TRole> & { readonly data: typeof UsersList.Type }) {
	const permission = !data.canChangeRoles && <p>Permission to assign roles is required to change roles.</p>;
	const users = data.users.length === 0 ? <p>No users.</p> : <UserRows {...controls} data={data} />;
	return (
		<div className="space-y-4">
			{permission}
			{users}
		</div>
	);
}

function UserHeaders() {
	return (
		<tr>
			{["Name", "Email", "Role", "Signed up"].map((label) => (
				<th className="p-3 whitespace-nowrap" key={label} scope="col">
					{label}
				</th>
			))}
		</tr>
	);
}
