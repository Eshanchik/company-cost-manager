import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";

import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Wallet className="size-6" />
          </div>
          <CardTitle className="text-xl">SubTrack</CardTitle>
          <CardDescription>
            Трекер подписок компании. Вход по корпоративному Google-аккаунту из
            белого списка.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signInWithGoogle}>
            <Button type="submit" className="w-full" size="lg">
              Войти через Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
