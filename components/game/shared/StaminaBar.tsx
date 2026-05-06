import { Progress } from "@/components/ui/progress";

export function StaminaBar({ stamina, maxStamina }: { stamina: number; maxStamina: number }) {
  const value = maxStamina > 0 ? Math.round((stamina / maxStamina) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
        <span>Stamina</span>
        <span>
          {stamina}/{maxStamina}
        </span>
      </div>
      <Progress value={value} className="h-2.5" />
    </div>
  );
}
