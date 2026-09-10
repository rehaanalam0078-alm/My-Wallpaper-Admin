import { useToast } from "../context/ToastContext";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (!toasts || toasts.length === 0) return null;

  const getIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-[#4edea3] shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-[#f59e0b] shrink-0" />;
      case "error":
        return <XCircle className="w-5 h-5 text-[#ef4444] shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-[#4cd7f6] shrink-0" />;
    }
  };

  const getBorderColor = (type) => {
    switch (type) {
      case "success":
        return "border-[#00885d]/60 bg-[#151c25]/95";
      case "warning":
        return "border-[#f59e0b]/50 bg-[#151c25]/95";
      case "error":
        return "border-[#93000a] bg-[#151c25]/95";
      default:
        return "border-[#2A374A] bg-[#151c25]/95";
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md animate-fade-in transition-all ${getBorderColor(
            toast.type
          )}`}
        >
          {getIcon(toast.type)}
          <div className="flex-1 min-w-0">
            {toast.title && (
              <h4 className="font-semibold text-sm text-[#dce3f0] leading-tight mb-0.5">
                {toast.title}
              </h4>
            )}
            <p className="text-xs text-[#908fa0] leading-relaxed break-words">
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-[#908fa0] hover:text-[#dce3f0] p-0.5 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
