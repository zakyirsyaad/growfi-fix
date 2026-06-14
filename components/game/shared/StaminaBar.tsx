export function StaminaBar({
  stamina,
  maxStamina,
}: {
  stamina: number;
  maxStamina: number;
}) {
  const value = maxStamina > 0 ? Math.round((stamina / maxStamina) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="pixel-label">Stamina</span>
        <span className="pixel-label text-[#91d985]">
          {stamina}/{maxStamina}
        </span>
      </div>
      <div className="pixel-progress">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
