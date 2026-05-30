import { useEffect, useMemo, useState } from "react";

import { Button } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import { deleteUser, listUsers } from "../lib/api";
import type { User } from "../types/api";

export function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const items = await listUsers();
      setUsers(items);
    } catch {
      setMessage("Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.phone.localeCompare(b.phone));
  }, [users]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setMessage("");
    try {
      await deleteUser(pendingDelete.id);
      setMessage(`Deleted ${pendingDelete.phone} and all related data.`);
      setPendingDelete(null);
      await refresh();
    } catch {
      setMessage("Delete failed. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="mt-2 text-sm text-muted-foreground">Review and remove users. Deleting a user removes their linked profile, guarantors, statements, loans, and score history.</p>
      </div>

      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Users</h2>
            <p className="text-sm text-muted-foreground">Total: {users.length}</p>
          </div>
          <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="py-3 font-medium">Phone</th>
                <th className="py-3 font-medium">Role</th>
                <th className="py-3 font-medium">Name</th>
                <th className="py-3 font-medium">Region</th>
                <th className="py-3 font-medium">Trade type</th>
                <th className="py-3 font-medium">Status</th>
                <th className="py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedUsers.map((user) => (
                <tr key={user.id}>
                  <td className="py-3">{user.phone}</td>
                  <td className="py-3 capitalize">{user.role.replace("_", " ")}</td>
                  <td className="py-3">{user.profile?.name || "-"}</td>
                  <td className="py-3">{user.profile?.region || "-"}</td>
                  <td className="py-3">{user.profile?.trade_type || "-"}</td>
                  <td className="py-3">{user.is_active ? "Active" : "Inactive"}</td>
                  <td className="py-3">
                    <Button
                      variant="secondary"
                      onClick={() => setPendingDelete(user)}
                      disabled={user.role === "admin"}
                      title={user.role === "admin" ? "Admin users are protected" : "Delete user"}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Are you sure?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Delete {pendingDelete.phone}? This removes the user and all secondary data linked to the account.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete user"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
