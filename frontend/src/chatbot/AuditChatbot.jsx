import { useState, useEffect, useRef, useCallback } from 'react';
import './AuditChatbot.css';

const API = 'http://localhost:5000/api/chatbot';

// Markdown-like renderer for AI responses
function renderContent(text) {
  return text
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<div class="cb-code-block"><div class="cb-code-lang">${lang || 'code'}</div><pre><code>${escHtml(code.trim())}</code></pre></div>`)
    .replace(/`([^`]+)`/g, '<code class="cb-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3} (.+)$/gm, '<div class="cb-heading">$1</div>')
    .replace(/^- (.+)$/gm, '<div class="cb-li">• $1</div>')
    .replace(/^\d+\. (.+)$/gm, '<div class="cb-li">$&</div>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function escHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export default function AuditChatbot({ auditId = null, auditContext = null, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `wax-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Welcome message
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: auditContext
        ? `👋 Hi! I'm your **WebAuditX AI Assistant**.\n\nI have access to your audit results. Ask me anything about your scores, issues, or how to fix them!`
        : `👋 Hi! I'm your **WebAuditX AI Assistant**.\n\nI can help you understand web audit concepts, explain SEO, performance, accessibility, security, and more.\n\nWhat would you like to know?`,
      id: 'welcome',
    }]);
  }, []);

  // Load suggestions
  useEffect(() => {
    if (!open) return;
    fetch(`${API}/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditContext }),
    })
      .then(r => r.json())
      .then(d => { if (d.success) setSuggestions(d.questions); })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open && !minimized) inputRef.current?.focus();
  }, [open, minimized]);

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setShowSugg(false);

    const userMsg = { role: 'user', content: msg, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const token = localStorage.getItem('wax_token');
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sessionId, message: msg, auditId, auditContext }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, id: data.sessionId + Date.now() }]);
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Sorry, I encountered an error. Please try again.',
        id: 'err' + Date.now(),
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId, auditId, auditContext]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = async () => {
    await fetch(`${API}/session/${sessionId}`, { method: 'DELETE' });
    setMessages([{
      role: 'assistant',
      content: '🔄 Chat cleared! How can I help you?',
      id: 'cleared' + Date.now(),
    }]);
    setShowSugg(true);
  };

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button className="cb-fab" onClick={() => setOpen(true)} title="Open AI Assistant">
          <span className="cb-fab-icon">🤖</span>
          <span className="cb-fab-label">AI Assistant</span>
          <span className="cb-fab-dot"></span>
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div className={`cb-window ${minimized ? 'cb-minimized' : ''}`}>
          {/* Header */}
          <div className="cb-header">
            <div className="cb-header-left">
              <div className="cb-avatar">X</div>
              <div>
                <div className="cb-title">WebAuditX AI</div>
                <div className="cb-status"><span className="cb-dot"></span>Online · Powered by LLaMA</div>
              </div>
            </div>
            <div className="cb-header-actions">
              <button className="cb-icon-btn" onClick={clearChat} title="Clear chat">↺</button>
              <button className="cb-icon-btn" onClick={() => setMinimized(p => !p)} title={minimized ? 'Expand' : 'Minimize'}>
                {minimized ? '⬆' : '⬇'}
              </button>
              <button className="cb-icon-btn cb-close-btn" onClick={() => setOpen(false)} title="Close">✕</button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="cb-messages">
                {messages.map(msg => (
                  <div key={msg.id} className={`cb-msg-wrap ${msg.role}`}>
                    {msg.role === 'assistant' && <div className="cb-msg-avatar">X</div>}
                    <div
                      className={`cb-bubble ${msg.role} ${msg.error ? 'error' : ''}`}
                      dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                    />
                    {msg.role === 'user' && <div className="cb-msg-avatar user">U</div>}
                  </div>
                ))}

                {loading && (
                  <div className="cb-msg-wrap assistant">
                    <div className="cb-msg-avatar">X</div>
                    <div className="cb-bubble assistant">
                      <div className="cb-typing">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {showSugg && suggestions.length > 0 && messages.length <= 1 && (
                  <div className="cb-suggestions">
                    <div className="cb-sugg-label">💡 Suggested questions</div>
                    {suggestions.map((q, i) => (
                      <button key={i} className="cb-sugg-btn" onClick={() => sendMessage(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="cb-input-area">
                <textarea
                  ref={inputRef}
                  className="cb-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about your audit results..."
                  rows={1}
                  disabled={loading}
                />
                <button
                  className="cb-send-btn"
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                >
                  {loading ? '⏳' : '↑'}
                </button>
              </div>
              <div className="cb-footer">Press Enter to send · Shift+Enter for new line</div>
            </>
          )}
        </div>
      )}
    </>
  );
}