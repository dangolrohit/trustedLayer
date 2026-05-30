import { useEffect, useState } from "react";
import { Users } from "lucide-react";

import { Panel, StatPanel } from "../components/ui/Panel";
import { listUsers } from "../lib/api";
import { roleLabel } from "../lib/utils";
import type { User } from "../types/api";

export function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    listUsers().then(setUsers);
  }, []);

  const merchants = users.filter((user) => user.role === "merchant");
  const staff = users.filter((user) => user.role !== "merchant");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">User and role visibility for the trust layer.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatPanel label="Total users" value={users.length} />
        <StatPanel label="Merchants" value={merchants.length} />
        <StatPanel label="Staff" value={staff.length} />
      </div>

      <Panel>
        <div className="mb-4 flex items-center gap-2">
          <Users className="text-primary" size={20} />
          <h2 className="font-semibold">Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="py-3 font-medium">Phone</th>
                <th className="py-3 font-medium">Name</th>
                <th className="py-3 font-medium">Role</th>
                <th className="py-3 font-medium">Trade</th>
                <th className="py-3 font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="py-3">{user.phone}</td>
                  <td className="py-3">{user.profile?.name || "No profile"}</td>
                  <td className="py-3">{roleLabel(user.role)}</td>
                  <td className="py-3">{user.profile?.trade_type || "-"}</td>
                  <td className="py-3">{user.is_active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
