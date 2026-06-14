import { AuthGate } from "@/components/layout/AuthGate";
import { ProfileDashboard } from "@/components/profile/ProfileDashboard";

export default function ProfilePage() {
  return (
    <AuthGate>
      <div className="space-y-6 mt-8">
        <div className="border-b border-border pb-4">
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">
            Farmer account
          </p>
          <h1 className="text-4xl font-black text-foreground">Profile</h1>
        </div>
        <ProfileDashboard />
      </div>
    </AuthGate>
  );
}
