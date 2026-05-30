import React from "react";
import { Button } from "../components/ui/Button";

export function LoanDeptUserManagementPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Loan Department Users</h1>
      <p className="mt-2 text-sm text-muted-foreground">Manage loan officers and department users.</p>
      <div className="mt-6">
        <p className="text-sm">Scaffold: implement hiring, role assignment, and access controls.</p>
        <div className="mt-4">
          <Button>Invite Loan Officer</Button>
        </div>
      </div>
    </div>
  );
}
