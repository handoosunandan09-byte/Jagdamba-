import React, { useState } from "react";
import ScreenHeader from "./ScreenHeader";
import { issueCategories, currentUser } from "../mock";
import { MapPin, Camera, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const ReportScreen = ({ onBack }) => {
  const [category, setCategory] = useState("");
  const [desc, setDesc] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!category || !desc.trim()) {
      toast.error("Please add a category and description");
      return;
    }
    const reports = JSON.parse(localStorage.getItem("saathi_reports") || "[]");
    reports.unshift({ id: Date.now(), category, desc, location: currentUser.location, at: new Date().toISOString() });
    localStorage.setItem("saathi_reports", JSON.stringify(reports));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex flex-col h-full">
        <ScreenHeader title="Report submitted" onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center float-up">
          <span className="h-20 w-20 rounded-full bg-[#DCEEE9] text-[#1C8C78] flex items-center justify-center mb-5 pop-in">
            <CheckCircle2 className="h-10 w-10" />
          </span>
          <h3 className="text-[20px] font-extrabold text-[#1B2A28]">Thank you, Priya!</h3>
          <p className="text-[14px] text-[#6B7A77] mt-2">Your report has been logged and forwarded to the local authorities. We&apos;ll notify you when it&apos;s picked up.</p>
          <p className="text-[12px] text-[#9AA7A3] mt-2">Ticket #{Math.floor(Math.random() * 90000 + 10000)}</p>
          <button onClick={onBack} className="mt-7 w-full rounded-2xl bg-[#E5603C] text-white py-3.5 text-[15px] font-bold hover:bg-[#d9542f] transition-colors">Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader title="Report a Civic Issue" subtitle="Help improve your neighbourhood" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 float-up space-y-4">
        <div className="bg-white rounded-2xl border border-[#EFE7DB] p-3.5 flex items-center gap-3">
          <span className="h-9 w-9 rounded-full bg-[#FBEAE3] text-[#E5603C] flex items-center justify-center"><MapPin className="h-4.5 w-4.5" /></span>
          <div>
            <p className="text-[12px] text-[#6B7A77]">Detected location</p>
            <p className="text-[14px] font-bold text-[#1B2A28]">{currentUser.location}</p>
          </div>
        </div>

        <div>
          <label className="text-[13px] font-semibold text-[#1B2A28] mb-2 block">Category</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full bg-white border-[#EFE7DB] rounded-2xl h-12 text-[14px]">
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
          <label className="text-[13px] font-semibold text-[#1B2A28] mb-2 block">Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={4}
            placeholder="Describe what you noticed…"
            className="w-full bg-white border border-[#EFE7DB] rounded-2xl p-4 text-[14px] text-[#1B2A28] placeholder:text-[#9AA7A3] outline-none focus:border-[#E5603C]/50 resize-none"
          />
        </div>

        <button className="w-full border-2 border-dashed border-[#D8E0DD] rounded-2xl py-5 flex flex-col items-center text-[#6B7A77] hover:border-[#1C8C78]/50 hover:text-[#1C8C78] transition-colors">
          <Camera className="h-6 w-6 mb-1" />
          <span className="text-[13px] font-medium">Add a photo (optional)</span>
        </button>

        <button onClick={submit} className="w-full rounded-2xl bg-[#E5603C] text-white py-4 text-[15px] font-bold shadow-[0_12px_28px_-10px_rgba(229,96,60,0.6)] hover:bg-[#d9542f] active:scale-[0.99] transition-all">
          Submit Report
        </button>
      </div>
    </div>
  );
};

export default ReportScreen;
