import React, { useState, useEffect, useCallback } from "react";
import ScreenHeader from "./ScreenHeader";
import { getContacts, addContact, deleteContact } from "../lib/api";
import { UserPlus, Trash2, Phone, User, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const ContactsScreen = ({ onBack }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", relation: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setContacts(await getContacts());
    } catch (e) {
      toast.error("Couldn't load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Add a name and phone number");
      return;
    }
    setSaving(true);
    try {
      const created = await addContact({ name: form.name.trim(), phone: form.phone.trim(), relation: form.relation.trim() || null });
      setContacts((c) => [...c, created]);
      setForm({ name: "", phone: "", relation: "" });
      setAdding(false);
      toast.success(`${created.name} added to your safety circle`);
    } catch (e) {
      toast.error("Couldn't add contact");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id, name) => {
    try {
      await deleteContact(id);
      setContacts((c) => c.filter((x) => x.id !== id));
      toast(`${name} removed`);
    } catch (e) {
      toast.error("Couldn't remove contact");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader title="Trusted contacts" subtitle="Who we alert when you need help" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 float-up">
        <div className="bg-[#56E6FF]/10 rounded-2xl p-4 mb-4">
          <p className="text-[13px] text-[#BFE9FF] leading-snug">
            When you press <span className="font-bold">SOS</span>, Jagdamba shares your live location with everyone in this circle.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10 text-[#7484AE]"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {contacts.map((c) => (
              <div key={c.id} className="bg-[#0E1A3A] rounded-2xl border border-[#78BEFF]/20 p-4 flex items-center gap-3">
                <span className="h-11 w-11 shrink-0 rounded-full bg-[#56E6FF]/10 text-[#56E6FF] flex items-center justify-center font-bold">
                  {c.name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14.5px] font-bold text-[#EEF4FF] truncate">{c.name}</p>
                  <div className="flex items-center gap-1.5 text-[12px] text-[#93A3CC] mt-0.5">
                    <Phone className="h-3 w-3" /> {c.phone}
                    {c.relation && <span className="ml-1 text-[#56E6FF] font-medium">· {c.relation}</span>}
                  </div>
                </div>
                <button onClick={() => remove(c.id, c.name)} className="h-9 w-9 rounded-full bg-[#FF9933]/15 text-[#FFB066] flex items-center justify-center hover:bg-[#f6dccf] transition-colors" aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {contacts.length === 0 && (
              <p className="text-center text-[13px] text-[#7484AE] py-6">No contacts yet. Add someone you trust.</p>
            )}
          </div>
        )}

        {!adding ? (
          <button onClick={() => setAdding(true)} className="w-full mt-4 rounded-2xl border-2 border-dashed border-[#56E6FF]/40 text-[#56E6FF] py-4 flex items-center justify-center gap-2 font-semibold hover:bg-[#56E6FF]/10/50 transition-colors">
            <UserPlus className="h-5 w-5" /> Add a trusted contact
          </button>
        ) : (
          <div className="mt-4 bg-[#0E1A3A] rounded-2xl border border-[#78BEFF]/20 p-4 pop-in">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[15px] font-bold text-[#EEF4FF]">New contact</p>
              <button onClick={() => setAdding(false)} className="text-[#7484AE]"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-[#13234D] rounded-xl px-3 py-2.5 border border-[#78BEFF]/20">
                <User className="h-4 w-4 text-[#7484AE]" />
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="flex-1 bg-transparent outline-none text-[14px] text-[#EEF4FF] placeholder:text-[#7484AE]" />
              </div>
              <div className="flex items-center gap-2 bg-[#13234D] rounded-xl px-3 py-2.5 border border-[#78BEFF]/20">
                <Phone className="h-4 w-4 text-[#7484AE]" />
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" className="flex-1 bg-transparent outline-none text-[14px] text-[#EEF4FF] placeholder:text-[#7484AE]" />
              </div>
              <input value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="Relation (optional) e.g. Mom, Friend" className="w-full bg-[#13234D] rounded-xl px-3 py-2.5 border border-[#78BEFF]/20 outline-none text-[14px] text-[#EEF4FF] placeholder:text-[#7484AE]" />
            </div>
            <button onClick={save} disabled={saving} className="w-full mt-4 rounded-2xl bg-[#E5603C] text-white py-3.5 text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-[#d9542f] transition-colors disabled:opacity-70">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : "Save contact"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactsScreen;
