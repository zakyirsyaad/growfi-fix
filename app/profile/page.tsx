import { AuthGate } from "@/components/layout/AuthGate";
import { ProfileDashboard } from "@/components/profile/ProfileDashboard";

export default function ProfilePage() {
  return (
    <AuthGate>
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Farmer account</p>
          <h1 className="text-3xl font-black text-leaf-950">Profile</h1>
        </div>
        <ProfileDashboard />
      </div>
    </AuthGate>
  );
}
