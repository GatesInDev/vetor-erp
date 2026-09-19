"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Layers3, LockKeyhole } from "lucide-react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
      if (!response.ok) throw new Error(response.status === 401 ? "E-mail ou senha inválidos." : "Não foi possível entrar. Recarregue a página e tente novamente.");
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
    } finally { setLoading(false); }
  }

  return <main className="login-shell">
    <div className="login-glow" />
    <div className="login-card island">
      <div className="brand-mark"><Layers3 size={24} /></div>
      <p className="eyebrow">VETOR ERP</p>
      <h1>Operação e finanças, em uma só visão.</h1>
      <p className="muted">Acesse o painel da sua empresa.</p>
      <form onSubmit={submit} className="login-form">
        <label>E-mail<input type="email" name="email" autoComplete="email" required placeholder="voce@empresa.com.br" /></label>
        <label>Senha<input type="password" name="password" autoComplete="current-password" required placeholder="Sua senha" /></label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button type="submit" disabled={loading} className="primary-button">{loading ? "Entrando..." : "Entrar"}<ArrowRight size={18} /></button>
      </form>
      <p className="secure-note"><LockKeyhole size={14} /> Sessão protegida</p>
    </div>
  </main>;
}
