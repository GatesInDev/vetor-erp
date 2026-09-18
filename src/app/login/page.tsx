import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  if (await currentActor()) redirect("/");
  return <LoginForm />;
}
