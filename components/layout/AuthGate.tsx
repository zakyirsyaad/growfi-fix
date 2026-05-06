"use client";

import { signIn, useSession } from "next-auth/react";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();

  if (status === "loading") {
    return <Card className="mx-auto max-w-md text-sm font-bold text-leaf-800">Loading farm...</Card>;
  }

  if (status !== "authenticated") {
    return (
      <Card className="mx-auto max-w-md space-y-4 text-center">
        <div>
          <h1 className="text-2xl font-black text-leaf-950">Discord login required</h1>
          <p className="mt-2 text-sm font-medium text-leaf-800">
            Your garden, inventory, trades, and wallet balance are tied to your Discord account.
          </p>
        </div>
        <Button onClick={() => signIn("discord")}>Login with Discord</Button>
      </Card>
    );
  }

  return <>{children}</>;
}
