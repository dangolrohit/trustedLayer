import React from "react";
import { Button } from "../components/ui/Button";

export function UserManagementPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">User Management</h1>
      <p className="mt-2 text-sm text-muted-foreground">List and manage application users.</p>

      <div className="mt-6">
        <p className="text-sm">Scaffold: implement user search, roles, and actions (suspend, reset password).</p>
        <div className="mt-4">
          <Button>Invite User</Button>
        </div>
      </div>
    </div>
  );
}
