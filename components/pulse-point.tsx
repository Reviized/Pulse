"use client";

import { useState, type FormEvent } from "react";

/**
 * The Pulse Point (CLAUDE.md locked terminology: never "chat bubble" or
 * "bot"). Section 6, item 14: answers as the current slide's assigned
 * speaker, grounded in the live site. This component is a controlled
 * singleton — SlideViewer owns `open` state and mounts one instance at the
 * deck root, so the corner trigger and the Ask slide's centered trigger
 * (Section 9: "final Ask slide where the Pulse Point centers and Q&A opens")
 * both open the exact same panel and conversation, never two separate
 * threads.
 */

type PulsePointMessage = {
  role: "visitor" | "replica" | "gravel";
  content: string;
};

export function PulsePoint({
  open,
  onOpenChange,
  experienceId,
  sessionKey,
  speakerProfileId,
  speakerName,
  hideTrigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experienceId: string;
  sessionKey: string;
  speakerProfileId: string | null;
  speakerName?: string | null;
  hideTrigger?: boolean;
}) {
  const [messages, setMessages] = useState<PulsePointMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || sending) return;
    setQuestion("");
    setMessages((m) => [...m, { role: "visitor", content: q }]);
    setSending(true);
    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experienceId,
          sessionKey,
          question: q,
          speakerProfileId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setMessages((m) => [
          ...m,
          { role: "gravel", content: "Pulse Point isn't connected yet, try again in a moment." },
        ]);
      } else if (data.gravel) {
        setMessages((m) => [...m, { role: "gravel", content: data.answer }]);
      } else {
        setMessages((m) => [...m, { role: "replica", content: data.answer }]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "gravel", content: "Pulse Point isn't connected yet, try again in a moment." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`pp-trigger${hideTrigger ? " hidden-for-ask" : ""}`}
        onClick={() => onOpenChange(!open)}
        aria-label="Open Pulse Point"
        title="Pulse Point"
      >
        <PulsePointIcon />
      </button>

      <div className={`pp-panel${open ? " open" : ""}`} role="dialog" aria-label="Pulse Point">
        <div className="pp-header">
          <div>
            <div className="pp-header-title">Pulse Point</div>
            <div className="pp-header-sub">
              {speakerName ? `Speaking with ${speakerName}` : "Ask anything about this experience"}
            </div>
          </div>
          <button type="button" className="pp-close" onClick={() => onOpenChange(false)} aria-label="Close Pulse Point">
            ×
          </button>
        </div>

        <div className="pp-messages">
          {messages.length === 0 && (
            <p className="pp-empty">Have a question about what you just saw? Ask it here and we will answer, grounded in the live site.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`pp-msg ${m.role}`}>
              {m.content}
            </div>
          ))}
          {sending && <div className="pp-typing">Pulse Point is answering…</div>}
        </div>

        <form className="pp-form" onSubmit={submit}>
          <input
            className="pp-input"
            type="text"
            placeholder="Type your question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={sending}
          />
          <button className="pp-send" type="submit" disabled={sending || !question.trim()}>
            Ask
          </button>
        </form>
      </div>
    </>
  );
}

function PulsePointIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12h4l2-6 3 12 2.5-9 1.5 3h6" />
    </svg>
  );
}
