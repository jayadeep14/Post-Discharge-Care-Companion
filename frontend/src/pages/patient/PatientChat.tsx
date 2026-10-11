import { useState } from "react"
import type { FormEvent } from "react"
import { useParams } from "react-router-dom"
import { Bot, LoaderCircle, Send, UserRound } from "lucide-react"

type ChatMessage = { role: "user" | "assistant"; content: string }

export default function PatientChat() {
  const { patientId = "" } = useParams()
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! Ask me a general question about your care plan or prescribed medicines. I can share educational information, but I can’t diagnose or replace your care team." },
  ])
  const [question, setQuestion] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  async function sendQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = question.trim()
    if (!text || sending) return
    const history = messages.slice(-8)
    setMessages(current => [...current, { role: "user", content: text }])
    setQuestion("")
    setSending(true)
    setError("")
    try {
      const apiUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")
      const response = await fetch(`${apiUrl}/api/v1/patients/${encodeURIComponent(patientId)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, history }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.detail || "Could not get a response right now.")
      setMessages(current => [...current, { role: "assistant", content: result.answer }])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not get a response right now.")
    } finally {
      setSending(false)
    }
  }

  return <section className="mx-auto flex min-h-[65vh] max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
    <header className="border-b border-gray-100 p-5">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-800"><Bot size={21} /></span><div><h2 className="font-semibold text-gray-900">Ask about your care</h2><p className="text-sm text-gray-500">Gemini uses your recorded diagnoses and medicines for context.</p></div></div>
      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">For urgent symptoms or emergencies, contact your care team or local emergency services. Don’t change a medicine based on chat advice.</p>
    </header>

    <div aria-live="polite" className="flex-1 space-y-4 overflow-y-auto p-5">
      {messages.map((message, index) => <div key={`${index}-${message.role}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
        {message.role === "assistant" && <Bot size={18} className="mt-2 shrink-0 text-emerald-700" />}
        <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-emerald-800 text-white" : "bg-gray-100 text-gray-800"}`}>{message.content}</p>
        {message.role === "user" && <UserRound size={18} className="mt-2 shrink-0 text-gray-500" />}
      </div>)}
      {sending && <div className="flex items-center gap-2 text-sm text-gray-500"><LoaderCircle size={16} className="animate-spin" />Thinking…</div>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>

    <form onSubmit={sendQuestion} className="flex items-end gap-2 border-t border-gray-100 p-4">
      <label className="sr-only" htmlFor="patient-question">Your question</label>
      <textarea id="patient-question" maxLength={2000} rows={2} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a question about your medicines or care…" className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
      <button type="submit" disabled={sending || !question.trim()} aria-label="Send question" className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-medium text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"><Send size={16} /><span className="hidden sm:inline">Send</span></button>
    </form>
  </section>
}
