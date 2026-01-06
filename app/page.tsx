import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";

export default async function Home() {
  const user = await getCurrentUser();
  
  // If user is logged in, redirect to map
  if (user) {
    redirect("/map");
  }
  
  // If not logged in, redirect to login
  redirect("/login");
}

