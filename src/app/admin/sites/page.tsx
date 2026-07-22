import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { addSite, updateSite } from "./actions";

interface Site {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofence_radius_meters: number;
  client_notes: string | null;
}

export default async function AdminSitesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await searchParams;

  const { data: sites } = await supabase
    .from("sites")
    .select("*")
    .order("name")
    .returns<Site[]>();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sites</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          Back to dashboard
        </Link>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add Site</CardTitle>
          <CardDescription>
            The address is geocoded automatically — no coordinates to look up
            yourself. Shifts posted at this site will geofence clock-ins
            against it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              "use server";
              await addSite(formData);
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="name">Site name</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder='e.g. "Client X — Downtown Office"'
                className="min-w-56"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" required className="min-w-64" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="geofence_radius_meters">Radius (meters)</Label>
              <Input
                id="geofence_radius_meters"
                name="geofence_radius_meters"
                type="number"
                min="25"
                step="1"
                defaultValue={150}
                className="w-28"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="client_notes">Notes (optional)</Label>
              <Input id="client_notes" name="client_notes" className="min-w-48" />
            </div>
            <Button type="submit" size="sm">
              Add Site
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {(sites ?? []).map((site) => (
          <Card key={site.id}>
            <CardHeader>
              <CardTitle>{site.name}</CardTitle>
              <CardDescription>
                {site.address} · {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)} ·{" "}
                {site.geofence_radius_meters}m radius
                {site.client_notes ? ` · ${site.client_notes}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <details>
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Edit radius / notes
                </summary>
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    await updateSite(formData);
                  }}
                  className="mt-3 flex flex-wrap items-end gap-3"
                >
                  <input type="hidden" name="id" value={site.id} />
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`radius-${site.id}`}>Radius (meters)</Label>
                    <Input
                      id={`radius-${site.id}`}
                      name="geofence_radius_meters"
                      type="number"
                      min="25"
                      step="1"
                      defaultValue={site.geofence_radius_meters}
                      className="w-28"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`notes-${site.id}`}>Notes</Label>
                    <Input
                      id={`notes-${site.id}`}
                      name="client_notes"
                      defaultValue={site.client_notes ?? ""}
                      className="min-w-48"
                    />
                  </div>
                  <Button type="submit" size="sm" variant="outline">
                    Save
                  </Button>
                </form>
              </details>
            </CardContent>
          </Card>
        ))}
        {(sites ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No sites yet.</p>
        )}
      </div>
    </main>
  );
}
