import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, BrainCircuit, Bot, User, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react";
import { RequestItem, PredictionOutput, UserProfile, SimulationResult, ChatMessage } from "../types";

interface AffordAiChatProps {
  request?: RequestItem;
  prediction?: PredictionOutput;
  profile?: UserProfile;
  simulation?: SimulationResult | null;
}

export const AffordAiChat: React.FC<AffordAiChatProps> = ({
  request,
  prediction,
  profile,
  simulation,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const cur = profile?.home_currency || "$";

  // Initial greeting message when request changes
  useEffect(() => {
    if (request && prediction && profile) {
      const initialGreeting: ChatMessage = {
        id: "msg-init-" + request.request_id,
        sender: "afford-ai",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `Hello! I am **AffordAI**, your autonomous financial intelligence agent.
I have simulated 90 days of cash flow for your profile (${profile.user_id}).

**Evaluation for "${request.request_text}":**
- **Safe to Pay Today:** ${cur} ${Number(prediction.amount_safe_to_pay).toLocaleString()}
- **Affordability Status:** \`${prediction.affordability_status}\`
- **Recommended Method:** \`${prediction.recommended_payment_method}\`
- **Earliest Full Date:** ${prediction.earliest_date_for_full_payment || "Beyond 90 days"}

Your protected reserve buffer of **${cur} ${Number(profile.minimum_balance_to_keep).toLocaleString()}** remains strictly safeguarded. How can I help you optimize this purchase?`,
      };
      setMessages([initialGreeting]);
    }
  }, [request?.request_id, prediction?.affordability_status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: "usr-" + Date.now(),
      sender: "user",
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/afford-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          currentRequest: request,
          userProfile: profile,
          simulationData: simulation,
          currentRecommendation: prediction,
        }),
      });

      if (!res.ok) {
        throw new Error("Chat request failed");
      }

      const data = await res.json();
      const aiReply: ChatMessage = {
        id: "ai-" + Date.now(),
        sender: "afford-ai",
        text: data.reply || "I evaluated your liquidity trajectory.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: "ai-err-" + Date.now(),
        sender: "afford-ai",
        text: `Based on your cash flow model, your maximum safe expenditure today is **${cur} ${simulation?.amountSafeToPay ?? 0}**. Any expenditure exceeding this breaches your mandatory **${cur} ${profile?.minimum_balance_to_keep ?? 0}** emergency buffer.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const samplePrompts = [
    "Can I afford to pay in full today?",
    "When is the earliest safe date for full payment?",
    "What flexible expenses can I pause?",
    "How was my safe-to-pay amount calculated?",
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[560px] overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-emerald-400">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-black tracking-tight text-white">AffordAI Copilot</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[10px] text-slate-300">
              Grounded in 90-day cash flow & financial datasheet
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px] bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-300">Reserve Floor:</span>
          <span className="font-mono font-bold text-white">
            {cur} {Number(profile?.minimum_balance_to_keep || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div
              key={msg.id}
              className={`flex items-start space-x-2.5 ${isUser ? "flex-row-reverse space-x-reverse" : ""}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isUser
                    ? "bg-slate-900 text-white"
                    : "bg-indigo-600 text-white shadow-2xs"
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  isUser
                    ? "bg-slate-900 text-white rounded-tr-none shadow-xs"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-2xs"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div
                  className={`mt-1 text-[10px] ${
                    isUser ? "text-slate-400 text-right" : "text-slate-400"
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start space-x-2.5">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl rounded-tl-none p-3 shadow-2xs">
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>AffordAI is calculating cash flow trajectory...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
          Ask:
        </span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(p)}
            disabled={isLoading}
            className="text-[11px] whitespace-nowrap bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors shrink-0 disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Field */}
      <div className="p-3 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          <input
            id="input-afford-chat"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask AffordAI any question about this expense or cash flow..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
            disabled={isLoading}
          />
          <button
            id="btn-send-afford-chat"
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold flex items-center justify-center shadow-xs transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
