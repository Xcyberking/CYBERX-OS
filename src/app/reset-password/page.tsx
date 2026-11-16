"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Command, LoaderCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const router=useRouter();
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if(password.length<8){setMessage("Use at least 8 characters.");return;}
    if(password!==confirm){setMessage("Passwords do not match.");return;}
    setBusy(true);
    try {
      const supabase=createClient();
      const {error}=await supabase.auth.updateUser({password});
      if(error) throw error;
      setMessage("Password updated. You can continue to your workspace.");
      setTimeout(()=>router.replace("/"),900);
    } catch(e) {setMessage(e instanceof Error?e.message:"Could not update password.");}
    finally {setBusy(false);}
  }
  return <main className="grid min-h-screen place-items-center px-4"><section className="panel w-full max-w-md rounded-3xl p-7"><Link href="/" className="mb-7 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300"><Command/></span><b>CYBERX <span className="text-cyan-300">OS</span></b></Link><h1 className="text-2xl font-bold">Set a new password</h1><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-xs text-slate-400">New password<input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"/></label><label className="block text-xs text-slate-400">Confirm password<input type="password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"/></label>{message&&<p role="status" className="rounded-xl bg-cyan-300/5 p-3 text-xs text-cyan-100">{message}</p>}<button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 p-3 text-sm font-bold text-slate-950 disabled:opacity-50">{busy&&<LoaderCircle size={15} className="animate-spin"/>}Update password</button></form></section></main>;
}
