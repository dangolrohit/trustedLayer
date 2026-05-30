import React from "react";

export function LoansAdminPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Loans</h1>
      <p className="mt-2 text-sm text-muted-foreground">Admin view for loans: approvals, disbursements, and history.</p>
      <div className="mt-6">
        <p className="text-sm">Scaffold: add loan metrics, filtering, and bulk actions.</p>
      </div>
    </div>
  );
}
