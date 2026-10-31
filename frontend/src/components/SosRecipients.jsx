import React from "react";
import { Check, MessageCircle } from "lucide-react";
import { buildSmsUri } from "../lib/api";

const chip = {
  sent: { cls: "text-[#2F6B4A] bg-[#E4EEE2]", label: "Sent" },
  failed: { cls: "text-[#C1452A] bg-[#FBEAE3]", label: "Failed" },
  not_sent: { cls: "text-[#B07A1E] bg-[#FBF1DE]", label: "Send from phone" },
};

// Per-contact delivery status for an SOS, plus a one-tap SMS fallback
// for anyone the server couldn't text (or when Twilio isn't configured).
const SosRecipients = ({ result }) => {
  const recipients = result?.recipients || [];
  const pending = recipients.filter((r) => r.status !== "sent");
  return (
    <div className="w-full">
      <div className="mt-4 w-full bg-white rounded-2xl border border-[#E7E0D1] divide-y divide-[#F1EADF] text-left">
        {recipients.map((r, i) => {
          const c = chip[r.status] || chip.not_sent;
          return (
            <div key={i} className="flex items-center gap-3 p-3">
              <span className="h-9 w-9 rounded-full bg-[#E4EEE2] text-[#2F6B4A] flex items-center justify-center font-bold text-[13px]">{r.name.trim().charAt(0).toUpperCase()}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-[#2A2A22] truncate">{r.name}</p>
                <p className="text-[11.5px] text-[#6E6A5E]">{r.phone}</p>
              </div>
              <span title={r.error || ""} className={`text-[11px] font-bold rounded-full px-2.5 py-1 flex items-center gap-1 ${c.cls}`}>
                {r.status === "sent" && <Check className="h-3 w-3" />} {c.label}
              </span>
            </div>
          );
        })}
      </div>
      {pending.length > 0 && result?.message && (
        <a href={buildSmsUri(pending.map((r) => r.phone), result.message)}
          className="mt-3 w-full rounded-2xl bg-[#E5603C] text-white py-3.5 text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-[#d9542f] transition-colors">
          <MessageCircle className="h-5 w-5" /> Send SMS from my phone
        </a>
      )}
    </div>
  );
};

export default SosRecipients;
