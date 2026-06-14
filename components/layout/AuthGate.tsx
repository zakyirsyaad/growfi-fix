"use client";

import { signIn, useSession } from "next-auth/react";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Leaf } from "lucide-react";

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 flex flex-col items-center justify-center space-y-4 border border-border shadow-2xl bg-card rounded-[2rem]">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center animate-pulse">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <div className="text-lg font-bold text-foreground">
            Loading farm...
          </div>
        </Card>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        {/* Soft Ambient Glows */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-30 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] opacity-20 bg-emerald-400/20 rounded-full blur-[100px] pointer-events-none" />
        
        <Card className="relative z-10 max-w-md w-full border border-border/50 shadow-2xl bg-card/80 backdrop-blur-xl rounded-[2rem] overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10" />
          <div className="p-10 flex flex-col items-center text-center space-y-8">
            <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center shadow-inner">
              <Leaf className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-black text-foreground tracking-tight">
                Welcome Back
              </h1>
              <p className="text-base font-medium text-muted-foreground leading-relaxed">
                Your garden, inventory, trades, and wallet balance are securely tied to your Discord identity.
              </p>
            </div>
            <Button 
              onClick={() => signIn("discord")}
              className="w-full py-6 text-lg rounded-xl font-bold bg-[#5865F2] hover:bg-[#4752C4] text-white transition-all shadow-lg hover:shadow-[#5865F2]/25"
            >
              Login with Discord
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
