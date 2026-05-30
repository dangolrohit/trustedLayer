import { Button } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Panel className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The requested page does not exist.</p>
        <Button className="mt-5" type="button" onClick={() => window.location.assign("/app")}>Back to dashboard</Button>
      </Panel>
    </div>
  );
}
