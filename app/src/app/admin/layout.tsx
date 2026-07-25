import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { AdminShell } from "@/components/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <AdminShell user={session.user} logoutAction={logout}>
      {children}
    </AdminShell>
  );
}
