import { LeaderboardDashboard } from "@/components/leaderboard/LeaderboardDashboard";

export default function LeaderboardPage() {
  return (
    <div className="space-y-6 mt-8">
      <div className="border-b border-border pb-4">
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">
          GrowFi ranks
        </p>
        <h1 className="text-4xl font-black text-foreground">Leaderboard</h1>
      </div>
      <LeaderboardDashboard />
    </div>
  );
}
