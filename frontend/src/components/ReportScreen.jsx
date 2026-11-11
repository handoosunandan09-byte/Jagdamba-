import React, { useState } from "react";
import ScreenHeader from "./ScreenHeader";
import { issueCategories } from "../config";
import { useUser } from "../context/UserContext";
import { MapPin, Camera, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitReport } from "../lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const ReportScreen = ({ onBack }) => {
  const { coords, locationLabel, locStatus, firstName } = useUser();
  const [category, setCategory] = useState("");
  const [desc, setDesc] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [ticket, setTicket] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!category || !desc.trim()) {
      toast.error("Please add a category and description");
      return;
    }
    setLoading(true);
    try {
      const data = await submitReport({
        category, description: desc, location: locationLabel,
        lat: coords?.lat ?? null, lng: coords?.lng ?? null,
      });
      setTicket(data.ticket);
      setSubmitted(true);
    } catch (e) {
      toast.error("Couldn't submit the report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col h-full">
        <ScreenHeader title="Report submitted" onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center float-up">
          <span className="h-20 w-20 rounded-full bg-[#56E6FF]/10 text-[#56E6FF] flex items-center justify-center mb-5 pop-in">
            <CheckCircle2 className="h-10 w-10" />
          </span>
          <h3 className="text-[20px] font-extrabold text-[#EEF4FF]">Thank you{firstName ? `, ${firstName}` : ""}!</h3>
          <p className="text-[14px] text-[#93A3CC] mt-2">Your report has been logged and is now visible to people nearby in Community Alerts.</p>
          <p className="text-[12px] text-[#7484AE] mt-2">Ticket #{ticket}</p>
          <button onClick={onBack} className="mt-7 w-full rounded-2xl bg-[#E5603C] text-white py-3.5 text-[15px] font-bold hover:bg-[#d9542f] transition-colors">Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader title="Report a Civic Issue" subtitle="Help improve your neighbourhood" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 float-up space-y-4">
        <div className="bg-[#0E1A3A] rounded-2xl border border-[#78BEFF]/20 p-3.5 flex items-center gap-3">
          <span className="h-9 w-9 rounded-full bg-[#FF9933]/15 text-[#FFB066] flex items-center justify-center"><MapPin className="h-4.5 w-4.5" /></span>
          <div>
            <p className="text-[12px] text-[#93A3CC]">Detected location</p>
            <p className="text-[14px] font-bold text-[#EEF4FF]">{locationLabel || (locStatus === "denied" ? "Location blocked — report won't appear on the map" : "Locating…")}</p>
          </div>
        </div>

        <div>
          <label className="text-[13px] font-semibold text-[#EEF4FF] mb-2 block">Category</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full bg-[#0E1A3A] border-[#78BEFF]/20 rounded-2xl h-12 text-[14px]">
              <SelectValue placeholder="Select an issue type" />
            </SelectTrigger>
            <SelectContent>
              {issueCategories.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-[13px] font-semibold text-[#EEF4FF] mb-2 block">Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={4}
            placeholder="Describe what you noticed…"
            className="w-full bg-[#0E1A3A] border border-[#78BEFF]/20 rounded-2xl p-4 text-[14px] text-[#EEF4FF] placeholder:text-[#7484AE] outline-none focus:border-[#E5603C]/50 resize-none"
          />
        </div>

        <button className="w-full border-2 border-dashed border-[#D8E0DD] rounded-2xl py-5 flex flex-col items-center text-[#93A3CC] hover:border-[#56E6FF]/50 hover:text-[#56E6FF] transition-colors">
          <Camera className="h-6 w-6 mb-1" />
          <span className="text-[13px] font-medium">Add a photo (optional)</span>
        </button>

        <button onClick={submit} disabled={loading} className="w-full rounded-2xl bg-[#E5603C] text-white py-4 text-[15px] font-bold shadow-[0_12px_28px_-10px_rgba(229,96,60,0.6)] hover:bg-[#d9542f] active:scale-[0.99] transition-all disabled:opacity-70 flex items-center justify-center gap-2">
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          {loading ? "Submitting…" : "Submit Report"}
        </button>
      </div>
    </div>
  );
};

export default ReportScreen;
