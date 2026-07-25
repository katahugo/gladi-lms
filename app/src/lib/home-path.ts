/**
 * Tujuan redirect setelah login berdasarkan role.
 */
export function homePathForRole(
  role: string | null | undefined,
  callbackUrl?: string | null,
): string {
  if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
    return callbackUrl;
  }
  switch (role) {
    case "admin":
      return "/admin";
    case "instructor":
      return "/instructor/dashboard";
    default:
      return "/dashboard";
  }
}
