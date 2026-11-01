import React from "react";
import { Check, MessageCircle, Send } from "lucide-react";
import { buildSmsUri, whatsappUrl } from "../lib/api";

const chip = {
  sent: { cls: "text-[#2F6B4A] bg-[#E4EEE2]", label: "Sent" },
  failed: { cls: "text-[#C1452A] bg-[#FBEAE3]", label: "Not delivered" },
  not_sent: { cls: "text-[#B07A1E] bg-[#FBF1DE]", label: "Tap to send" },
};

// "Sent on WhatsApp", "Sent by SMS", "Sent on WhatsApp + SMS"
const sentLabel = (channels = {}) => {
  const ok = Object.entries(channels).filter(([, s]) => s === "sent").map(([ch]) => (ch === "whatsapp" ? "WhatsApp" : "SMS"));
  if (!ok.length) return "Sent";
  return ok.length === 1 ? (ok[0] === "WhatsApp" ? "Sent on WhatsApp" : "Sent by SMS") : `Sent on ${ok.join(" + ")}`;
};

// Per-contact delivery status for an SOS, with a one-tap WhatsApp message for
// every contact and an SMS fallback for anyone the server couldn't text.
const SosRecipients = ({ result }) => {
  const recipients = result?.recipients || [];
  const pending = recipients.filter((r) => r.status !== "sent");
  const message = result?.message || "";
  return (
    <div className="w-full">
      {result?.delivery === "not_configured" && recipients.length > 0 && (
        <p className="mt-4 text-left text-[12px] leading-snug text-[#8A5A12] bg-[#FBF1DE] border border-[#E9D3A8] rounded-xl px-3 py-2.5">
          Automatic sending isn&apos;t switched on yet, so alerts can&apos;t go out by themselves. Tap WhatsApp below to send now.
        </p>
      )}
      <div className="mt-4 w-full bg-white rounded-2xl border border-[#E7E0D1] divide-y divide-[#F1EADF] text-left">
        {recipients.map((r, i) => {
          const c = chip[r.status] || chip.not_sent;
          return (
            <div key={i} className="flex items-center gap-3 p-3">
              <span className="h-9 w-9 shrink-0 rounded-full bg-[#E4EEE2] text-[#2F6B4A] flex items-center justify-center font-bold text-[13px]">{r.name.trim().charAt(0).toUpperCase()}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-[#2A2A22] truncate">{r.name}</p>
                <span title={r.error || ""} className={`mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-bold rounded-full px-2 py-0.5 ${c.cls}`}>
                  {r.status === "sent" && <Check className="h-3 w-3" />} {r.status === "sent" ? sentLabel(r.channels) : c.label}
                </span>
                {r.status === "failed" && r.error && (
                  <p className="text-[10.5px] text-[#C1452A] mt-1 leading-snug">{r.error.replace(/^(whatsapp|sms): /i, "")}</p>
                )}
              </div>
              <a href={whatsappUrl(r.phone, message)} target="_blank" rel="noreferrer"
                className="shrink-0 rounded-full bg-[#25D366] text-white px-3 py-2 text-[12.5px] font-bold flex items-center gap-1.5 hover:bg-[#1EBE5A] transition-colors"
                aria-label={`Send SOS to ${r.name} on WhatsApp`}>
                <Send className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </div>
          );
        })}
      </div>
      {pending.length > 0 && message && (
        <a href={buildSmsUri(pending.map((r) => r.phone), message)}
          className="mt-3 w-full rounded-2xl bg-white border border-[#E7E0D1] text-[#2A2A22] py-3 text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#F3ECE1] transition-colors">
          <MessageCircle className="h-4 w-4" /> Send as SMS from my phone
        </a>
      )}
    </div>
  );
};

export default SosRecipients;
