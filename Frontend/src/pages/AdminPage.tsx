import { useCallback, useEffect, useState } from "react";
import { BarChart3, Settings, UserPlus, Users } from "lucide-react";

import { Button } from "../components/ui/Button";
import { Field, Input, Textarea } from "../components/ui/Input";
import { Panel, StatPanel } from "../components/ui/Panel";
import { createSetting, createUser, deleteUser, getAnalytics, listSettings, listUsers, updateSetting, updateUser } from "../lib/api";
import { roleLabel } from "../lib/utils";
import { useAuthStore } from "../store/auth";
import type { Analytics, Role, SystemSetting, User } from "../types/api";

export function AdminPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newUser, setNewUser] = useState({
    phone: "",
    password: "",
    role: "merchant" as Role,
    name: "",
    region: "",
    trade_type: "",
    address: "",
  });
  const [newSetting, setNewSetting] = useState({ key: "", value: "", description: "" });

  const isAdmin = currentUser?.role === "admin";

  const refresh = useCallback(async () => {
    const nextUsers = await listUsers();
    setUsers(nextUsers);
    if (isAdmin) {
      const [nextAnalytics, nextSettings] = await Promise.all([getAnalytics(), listSettings()]);
      setAnalytics(nextAnalytics);
      setSettings(nextSettings);
    }
  }, [isAdmin]);

  useEffect(() => {
    refresh().catch(() => setMessage("Unable to load admin data."));
  }, [refresh]);

  const merchants = users.filter((user) => user.role === "merchant");
  const staff = users.filter((user) => user.role !== "merchant");

  const onCreateUser = async () => {
    setMessage("");
    await createUser({ ...newUser, is_active: true });
    setNewUser({ phone: "", password: "", role: "merchant", name: "", region: "", trade_type: "", address: "" });
    setMessage("User created.");
    await refresh();
  };

  const onToggleActive = async (user: User) => {
    await updateUser(user.id, { is_active: !user.is_active });
    await refresh();
  };

  const onDeleteUser = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setMessage("");
    try {
      await deleteUser(pendingDelete.id);
      setPendingDelete(null);
      setMessage(`Deleted ${pendingDelete.phone} and all related data.`);
      await refresh();
    } catch {
      setMessage("Delete failed. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  const onCreateSetting = async () => {
    setMessage("");
    await createSetting(newSetting);
    setNewSetting({ key: "", value: "", description: "" });
    setMessage("Setting saved.");
    await refresh();
  };

  const onSettingValueChange = async (setting: SystemSetting, value: string) => {
    await updateSetting(setting.id, { value });
    await refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? "Admin" : "Merchant Review"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin
            ? "Manage users, system settings, merchants, and analytics."
            : "View merchants and trust scores for application review."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatPanel label="Total users" value={users.length} />
        <StatPanel label="Merchants" value={merchants.length} />
        <StatPanel label="Staff" value={staff.length} />
        {isAdmin ? <StatPanel label="Pending loans" value={analytics?.loans.pending ?? 0} /> : null}
        {isAdmin ? <StatPanel label="Avg score" value={analytics?.trust.average_score ?? 0} /> : null}
      </div>

      {isAdmin ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel>
            <div className="mb-4 flex items-center gap-2">
              <UserPlus className="text-primary" size={20} />
              <h2 className="font-semibold">Create user</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <Input value={newUser.phone} onChange={(event) => setNewUser((current) => ({ ...current, phone: event.target.value }))} />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={newUser.password}
                  onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                />
              </Field>
              <Field label="Role">
                <select
                  className="focus-ring h-11 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={newUser.role}
                  onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value as Role }))}
                >
                  <option value="merchant">Merchant</option>
                  <option value="loan_department">Loan Department</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              <Field label="Name">
                <Input value={newUser.name} onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="Region">
                <Input value={newUser.region} onChange={(event) => setNewUser((current) => ({ ...current, region: event.target.value }))} />
              </Field>
              <Field label="Trade type">
                <Input
                  value={newUser.trade_type}
                  onChange={(event) => setNewUser((current) => ({ ...current, trade_type: event.target.value }))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address">
                  <Textarea value={newUser.address} onChange={(event) => setNewUser((current) => ({ ...current, address: event.target.value }))} />
                </Field>
              </div>
            </div>
            <Button className="mt-4" onClick={onCreateUser} disabled={!newUser.phone || !newUser.password}>
              Create user
            </Button>
          </Panel>

          <Panel>
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="text-primary" size={20} />
              <h2 className="font-semibold">Analytics</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Approved loans", analytics?.loans.approved ?? 0],
                ["Rejected loans", analytics?.loans.rejected ?? 0],
                ["Strong merchants", analytics?.trust.strong_merchants ?? 0],
                ["Thin merchants", analytics?.trust.thin_merchants ?? 0],
                ["Guarantors", analytics?.signals.guarantors ?? 0],
                ["Psychometric", analytics?.signals.psychometric_responses ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-border pb-3">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-bold">{value}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {isAdmin ? (
        <Panel>
          <div className="mb-4 flex items-center gap-2">
            <Settings className="text-primary" size={20} />
            <h2 className="font-semibold">System settings</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-[180px_180px_1fr_auto] md:items-end">
            <Field label="Key">
              <Input value={newSetting.key} onChange={(event) => setNewSetting((current) => ({ ...current, key: event.target.value }))} />
            </Field>
            <Field label="Value">
              <Input value={newSetting.value} onChange={(event) => setNewSetting((current) => ({ ...current, value: event.target.value }))} />
            </Field>
            <Field label="Description">
              <Input
                value={newSetting.description}
                onChange={(event) => setNewSetting((current) => ({ ...current, description: event.target.value }))}
              />
            </Field>
            <Button onClick={onCreateSetting} disabled={!newSetting.key || !newSetting.value}>Save</Button>
          </div>
          <div className="mt-4 divide-y divide-border">
            {settings.map((setting) => (
              <div key={setting.id} className="grid gap-3 py-3 md:grid-cols-[220px_1fr_140px] md:items-center">
                <div>
                  <p className="font-medium">{setting.key}</p>
                  <p className="text-xs text-muted-foreground">{setting.description || "No description"}</p>
                </div>
                <Input defaultValue={setting.value} onBlur={(event) => void onSettingValueChange(setting, event.target.value)} />
                <p className="text-xs text-muted-foreground">{new Date(setting.updated_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel>
        <div className="mb-4 flex items-center gap-2">
          <Users className="text-primary" size={20} />
          <h2 className="font-semibold">{isAdmin ? "Users" : "Merchants"}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="py-3 font-medium">Phone</th>
                <th className="py-3 font-medium">Name</th>
                <th className="py-3 font-medium">Role</th>
                <th className="py-3 font-medium">Trade</th>
                <th className="py-3 font-medium">Score</th>
                <th className="py-3 font-medium">Active</th>
                {isAdmin ? <th className="py-3 font-medium">Action</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(isAdmin ? users : merchants).map((user) => (
                <tr key={user.id}>
                  <td className="py-3">{user.phone}</td>
                  <td className="py-3">{user.profile?.name || "No profile"}</td>
                  <td className="py-3">{roleLabel(user.role)}</td>
                  <td className="py-3">{user.profile?.trade_type || "-"}</td>
                  <td className="py-3">{user.profile?.trust_score ?? "-"}</td>
                  <td className="py-3">{user.is_active ? "Yes" : "No"}</td>
                  {isAdmin ? (
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => onToggleActive(user)}>
                          {user.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button size="sm" onClick={() => setPendingDelete(user)} disabled={user.role === "admin"}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

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
              <Button onClick={onDeleteUser} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete user"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
