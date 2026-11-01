import React, { useCallback, useEffect, useState } from "react";
import ScreenHeader from "./ScreenHeader";
import { listEvidence, buildEvidenceBlob, deleteEvidence, downloadBlob, evidenceFileName } from "../lib/emergencyDB";
import { Video, Download, Share2, Trash2, Play, Loader2, AudioLines } from "lucide-react";
import { toast } from "sonner";

const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtDur = (s) => (s == null ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const fmtWhen = (t) => new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// Evidence locker: the front-camera video + voice recorded during each SOS, kept on this phone.
const RecordingsScreen = ({ onBack }) => {
  const [items, setItems] = useState(null);
  const [playing, setPlaying] = useState(null); // { id, url, kind }
  const [busy, setBusy] = useState(null);
  const refresh = useCallback(async () => setItems(await listEvidence()), []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => () => { if (playing?.url) URL.revokeObjectURL(playing.url); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const withBlob = async (item, fn) => {
    setBusy(item.evidenceId);
    try {
      const blob = await buildEvidenceBlob(item.evidenceId, item.mimeType);
      if (blob) await fn(blob);
    } finally {
      setBusy(null);
    }
  };

  const play = (item) => withBlob(item, (blob) => {
    if (playing?.url) URL.revokeObjectURL(playing.url);
    setPlaying({ id: item.evidenceId, url: URL.createObjectURL(blob), kind: item.kind });
  });

  const save = (item) => withBlob(item, (blob) => {
    downloadBlob(blob, evidenceFileName(item));
    toast.success("Saved to your phone's Downloads");
  });

  const share = (item) => withBlob(item, async (blob) => {
    const file = new File([blob], evidenceFileName(item), { type: item.mimeType });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Jagdamba recording" }); } catch (e) { /* cancelled */ }
    } else {
      downloadBlob(blob, file.name);
      toast("Sharing isn't supported here, so it was saved to Downloads instead.");
    }
  });

  const remove = async (item) => {
    if (!window.confirm("Delete this recording from the app? Copies already saved to Downloads are not affected.")) return;
    await deleteEvidence(item.evidenceId);
    if (playing?.id === item.evidenceId) setPlaying(null);
    refresh();
  };

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader title="SOS recordings" subtitle="Front-camera video and voice from each SOS" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 float-up">
        {items === null && (
          <div className="flex items-center justify-center gap-2 py-10 text-[#6B7A77] text-[13px]"><Loader2 className="h-5 w-5 animate-spin" /> Loading recordings…</div>
        )}
        {items && items.length === 0 && (
          <p className="text-center text-[13px] text-[#6B7A77] py-8 px-6">No recordings yet. When an SOS starts, Jagdamba records video (or voice if the camera is blocked) and keeps it here.</p>
        )}

        <div className="space-y-3">
          {(items || []).map((it) => {
            const Icon = it.kind === "audio" ? AudioLines : Video;
            const isPlaying = playing?.id === it.evidenceId;
            return (
              <div key={it.evidenceId} className="bg-white rounded-2xl border border-[#EFE7DB] p-3.5">
                <div className="flex items-center gap-3">
                  <span className="h-10 w-10 shrink-0 rounded-full bg-[#E4EEE2] text-[#2F6B4A] flex items-center justify-center"><Icon className="h-5 w-5" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-[#1B2A28] truncate">{it.label || (it.kind === "audio" ? "Voice recording" : "Video recording")}</p>
                    <p className="text-[11.5px] text-[#6B7A77]">{fmtWhen(it.startedAt)} · {fmtDur(it.durationS)} · {fmtSize(it.size)}</p>
                  </div>
                  {busy === it.evidenceId && <Loader2 className="h-4 w-4 animate-spin text-[#6B7A77]" />}
                </div>
                {isPlaying && (
                  it.kind === "audio"
                    ? <audio src={playing.url} controls autoPlay className="w-full mt-3" />
                    : <video src={playing.url} controls autoPlay playsInline className="w-full mt-3 rounded-xl bg-black max-h-[260px]" />
                )}
                <div className="grid grid-cols-4 gap-2 mt-3">
                  <button onClick={() => play(it)} className="rounded-xl bg-[#F3F6F4] py-2 text-[11.5px] font-semibold text-[#2F6B4A] flex flex-col items-center gap-0.5"><Play className="h-4 w-4" /> Play</button>
                  <button onClick={() => save(it)} className="rounded-xl bg-[#F3F6F4] py-2 text-[11.5px] font-semibold text-[#2F6B4A] flex flex-col items-center gap-0.5"><Download className="h-4 w-4" /> Save</button>
                  <button onClick={() => share(it)} className="rounded-xl bg-[#F3F6F4] py-2 text-[11.5px] font-semibold text-[#2F6B4A] flex flex-col items-center gap-0.5"><Share2 className="h-4 w-4" /> Share</button>
                  <button onClick={() => remove(it)} className="rounded-xl bg-[#FBEAE3] py-2 text-[11.5px] font-semibold text-[#C1452A] flex flex-col items-center gap-0.5"><Trash2 className="h-4 w-4" /> Delete</button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-[#9AA7A3] text-center mt-5 pb-4">Recordings stay on this phone. Clearing your browser&apos;s site data removes them, so save important ones to Downloads.</p>
      </div>
    </div>
  );
};

export default RecordingsScreen;
