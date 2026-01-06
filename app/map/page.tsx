import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import MapClient from "./MapClient";

export default async function MapPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <MapClient />;
}
