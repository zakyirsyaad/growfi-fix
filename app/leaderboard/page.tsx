import { LeaderboardDashboard } from "@/components/leaderboard/LeaderboardDashboard";

export default function LeaderboardPage() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-muted-foreground">
          GrowFi ranks
        </p>
        <h1 className="text-3xl font-black text-leaf-950">Leaderboard</h1>
      </div>
      <LeaderboardDashboard />
    </div>
  );
}
