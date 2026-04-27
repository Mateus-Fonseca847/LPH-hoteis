import { HeaderClient } from "@/components/HeaderClient";
import { getCurrentUser } from "@/lib/auth/user";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <HeaderClient
      user={
        user
          ? {
              name: user.name,
              globalRole: user.globalRole,
            }
          : null
      }
    />
  );
}
