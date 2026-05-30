import React from "react";
import { Button } from "../components/ui/Button";

export function StaffManagementPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Staff Management</h1>
      <p className="mt-2 text-sm text-muted-foreground">List, invite, and manage staff accounts for your organization.</p>

      <div className="mt-6">
        <p className="text-sm">This is a scaffolded page. Implement staff list and CRUD here.</p>
        <div className="mt-4">
          <Button variant="primary">Invite Staff</Button>
        </div>
      </div>
    </div>
  );
}
