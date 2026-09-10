export default function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  badgeText,
  badgeColor = "text-[#4edea3]",
  progressPercent,
  footer
}) {
  return (
    <div className="p-5 rounded-xl bg-[#192029] border border-[#2A374A] shadow-sm flex flex-col justify-between hover:border-[#6366f1]/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-xs font-medium text-[#908fa0] uppercase tracking-wider">
          {title}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-[#232a34] border border-[#2A374A] flex items-center justify-center text-[#c0c1ff]">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#dce3f0] font-sans tracking-tight">
            {value}
          </span>
          {badgeText && (
            <span className={`text-xs font-mono font-medium ${badgeColor}`}>
              {badgeText}
            </span>
          )}
        </div>

        {subtext && (
          <p className="text-xs text-[#908fa0]">{subtext}</p>
        )}

        {typeof progressPercent === "number" && (
          <div className="w-full bg-[#151c25] rounded-full h-1.5 mt-3 overflow-hidden border border-[#2A374A]/40">
            <div
              className="bg-gradient-to-r from-[#6366f1] to-[#4cd7f6] h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        )}
      </div>

      {footer && (
        <div className="pt-3 mt-3 border-t border-[#2A374A]/60 text-[11px] text-[#908fa0] flex items-center justify-between">
          {footer}
        </div>
      )}
    </div>
  );
}
