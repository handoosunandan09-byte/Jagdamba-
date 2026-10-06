import React, { useState, useRef, useEffect } from "react";
import ScreenHeader from "./ScreenHeader";
import { saathiIntro, saathiReplies, defaultSaathiReply } from "../mock";
import { Send, Mic, ShieldCheck } from "lucide-react";

const getReply = (text) => {
  const t = text.toLowerCase();
  for (const r of saathiReplies) {
    if (r.keywords.some((k) => t.includes(k))) return r.reply;
  }
  return defaultSaathiReply;
};

const TalkScreen = ({ onBack, emergency }) => {
  const [messages, setMessages] = useState([{ from: "saathi", text: saathiIntro }]);
  const [input, setInput] = useState(emergency ? "I need help right now" : "");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { from: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { from: "saathi", text: getReply(text) }]);
    }, 900);
  };

  const suggestions = ["Someone is following me", "Report a broken street light", "I feel unsafe walking home"];

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader title="Talk to Saathi" subtitle="Voice or text • private & secure" onBack={onBack} />
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"} pop-in`}>
            {m.from === "saathi" && (
              <span className="mt-1 mr-2 h-7 w-7 shrink-0 rounded-full bg-[#17302B] flex items-center justify-center">
                <ShieldCheck className="h-3.5 w-3.5 text-[#E5603C]" />
              </span>
            )}
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[14px] leading-snug ${
                m.from === "user"
                  ? "bg-[#E5603C] text-white rounded-br-md"
                  : "bg-white border border-[#EFE7DB] text-[#1B2A28] rounded-bl-md"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <span className="mt-1 mr-2 h-7 w-7 shrink-0 rounded-full bg-[#17302B] flex items-center justify-center">
              <ShieldCheck className="h-3.5 w-3.5 text-[#E5603C]" />
            </span>
            <div className="bg-white border border-[#EFE7DB] rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
              <span className="h-2 w-2 rounded-full bg-[#9AA7A3] animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 rounded-full bg-[#9AA7A3] animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 rounded-full bg-[#9AA7A3] animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-2.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setInput(s)}
              className="shrink-0 text-[12px] font-medium text-[#1C8C78] bg-[#DCEEE9] rounded-full px-3 py-1.5 hover:bg-[#cfe8e2] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#EFE7DB] rounded-full pl-4 pr-1.5 py-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Tell Saathi what happened…"
            className="flex-1 bg-transparent outline-none text-[14px] text-[#1B2A28] placeholder:text-[#9AA7A3]"
          />
          <button className="h-9 w-9 rounded-full bg-[#DCEEE9] text-[#1C8C78] flex items-center justify-center hover:bg-[#cfe8e2] transition-colors" aria-label="Voice">
            <Mic className="h-4.5 w-4.5" />
          </button>
          <button onClick={send} className="h-9 w-9 rounded-full bg-[#E5603C] text-white flex items-center justify-center hover:bg-[#d9542f] transition-colors" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TalkScreen;
