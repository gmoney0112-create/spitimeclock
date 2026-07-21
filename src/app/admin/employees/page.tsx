import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
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
import { addEmployee, updateEmployee, setEmployeeStatus } from "./actions";
import type { Employee } from "@/types/database";

export default async function AdminEmployeesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .order("full_name")
    .returns<Employee[]>();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Employees</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          Back to dashboard
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Employee</CardTitle>
          <CardDescription>
            Add them before their first sign-in so their pay rate and role are
            set from day one — the account links automatically the first time
            they sign in with this email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              "use server";
              await addEmployee(formData);
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                defaultValue="employee"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="employee">Employee</option>
                <option value="office_manager">Office Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="pay_type">Pay type</Label>
              <select
                id="pay_type"
                name="pay_type"
                defaultValue="hourly"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="hourly">Hourly</option>
                <option value="salary">Salary</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="hourly_rate">Hourly rate</Label>
              <Input id="hourly_rate" name="hourly_rate" type="number" step="0.01" min="0" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="hire_date">Hire date</Label>
              <Input id="hire_date" name="hire_date" type="date" />
            </div>
            <Button type="submit" size="sm">
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {(employees ?? []).map((employee) => (
          <Card key={employee.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {employee.full_name}
                <Badge variant={employee.status === "active" ? "success" : "secondary"}>
                  {employee.status}
                </Badge>
                {!employee.auth_user_id && (
                  <Badge variant="outline">Not signed in yet</Badge>
                )}
              </CardTitle>
              <CardDescription>{employee.email}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <details>
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Edit role / pay
                </summary>
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    await updateEmployee(formData);
                  }}
                  className="mt-3 flex flex-wrap items-end gap-3"
                >
                  <input type="hidden" name="id" value={employee.id} />
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`role-${employee.id}`}>Role</Label>
                    <select
                      id={`role-${employee.id}`}
                      name="role"
                      defaultValue={employee.role}
                      className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      <option value="employee">Employee</option>
                      <option value="office_manager">Office Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`pay_type-${employee.id}`}>Pay type</Label>
                    <select
                      id={`pay_type-${employee.id}`}
                      name="pay_type"
                      defaultValue={employee.pay_type}
                      className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="salary">Salary</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`hourly_rate-${employee.id}`}>Hourly rate</Label>
                    <Input
                      id={`hourly_rate-${employee.id}`}
                      name="hourly_rate"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={employee.hourly_rate ?? ""}
                    />
                  </div>
                  <Button type="submit" size="sm" variant="outline">
                    Save
                  </Button>
                </form>
              </details>

              <form
                action={async () => {
                  "use server";
                  await setEmployeeStatus(
                    employee.id,
                    employee.status === "active" ? "inactive" : "active",
                  );
                }}
              >
                <Button
                  type="submit"
                  size="sm"
                  variant={employee.status === "active" ? "destructive" : "outline"}
                >
                  {employee.status === "active" ? "Deactivate" : "Reactivate"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
        {(employees ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No employees yet.</p>
        )}
      </div>
    </main>
  );
}
