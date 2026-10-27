import { DateTime } from "effect";
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
	return canChangeRoles ? (
		<select
			aria-label={`Role for ${user.email}`}
			className="rounded-md border bg-background p-2"
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
	) : (
		user.role
	);
}

function UserRow<TRole extends string>({
	user,
	canChangeRoles,
	...controls
}: RoleControls<TRole> & { readonly user: typeof AppUser.Type; readonly canChangeRoles: boolean }) {
	return (
		<tr className="border-b">
			<td className="p-3">{user.name}</td>
			<td className="p-3">{user.email}</td>
			<td className="p-3">
				<UserRole {...controls} canChangeRoles={canChangeRoles} user={user} />
			</td>
			<td className="whitespace-nowrap p-3">
				<time dateTime={DateTime.formatIso(user.createdAt)}>{DateTime.formatIso(user.createdAt)}</time>
			</td>
		</tr>
	);
}
function UserRows<TRole extends string>({ data, ...controls }: RoleControls<TRole> & { readonly data: typeof UsersList.Type }) {
	return (
		<div className="overflow-x-auto rounded-md border">
			<table className="w-full text-left text-sm">
				<caption className="sr-only">App users and roles</caption>
				<thead className="bg-muted">
					<UserHeaders />
				</thead>
				<tbody>
					{data.users.map((user) => (
						<UserRow {...controls} canChangeRoles={data.canChangeRoles} key={user.id} user={user} />
					))}
				</tbody>
			</table>
		</div>
	);
}
export function UsersTable<TRole extends string>({ data, ...controls }: RoleControls<TRole> & { readonly data: typeof UsersList.Type }) {
	return (
		<div className="space-y-4">
			{data.canChangeRoles ? null : <p>Permission to assign roles is required to change roles.</p>}
			{data.users.length === 0 ? <p>No users.</p> : <UserRows {...controls} data={data} />}
		</div>
	);
}

function UserHeaders() {
	return (
		<tr>
			{["Name", "Email", "Role", "Signed up"].map((label) => (
				<th className="whitespace-nowrap p-3" key={label} scope="col">
					{label}
				</th>
			))}
		</tr>
	);
}
