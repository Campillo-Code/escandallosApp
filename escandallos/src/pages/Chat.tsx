import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import SearchBar from "../components/SearchBar";
import { MessageCircle, Send, ChevronLeft, Phone } from "lucide-react";

interface Conversation {
  telefono: string;
  ultima_fecha: string;
  total_mensajes: number;
}

interface Message {
  id: number;
  telefono: string;
  mensaje: string;
  direccion: string;
  fecha: string;
}

export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    try {
      const data = await invoke<Conversation[]>("get_whatsapp_conversaciones");
      setConversations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (telefono: string) => {
    try {
      const data = await invoke<Message[]>("get_whatsapp_messages", { telefono });
      setMessages(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedPhone) {
      loadMessages(selectedPhone);
    }
  }, [selectedPhone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedPhone) return;
    try {
      await invoke("send_whatsapp_message_manual", {
        telefono: selectedPhone,
        mensaje: newMessage.trim(),
      });
      setNewMessage("");
      await loadMessages(selectedPhone);
      await loadConversations();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredConversations = conversations.filter(c =>
    c.telefono.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedPhone) {
    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { setSelectedPhone(null); setMessages([]); }}
            className="text-gray-500 hover:text-gray-700">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Phone size={20} /> {selectedPhone}
            </h2>
          </div>
        </div>

        <div className="flex-1 bg-gray-50 rounded-xl border overflow-auto p-4 mb-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <p>No hay mensajes en esta conversación</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map(msg => {
                const isIncoming = msg.direccion === 'in';
                return (
                  <div key={msg.id} className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[75%] rounded-xl px-4 py-2 shadow-sm ${
                      isIncoming
                        ? 'bg-white border border-gray-200'
                        : 'bg-blue-600 text-white'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.mensaje}</p>
                      <p className={`text-[10px] mt-1 ${isIncoming ? 'text-gray-400' : 'text-blue-200'}`}>
                        {msg.fecha}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Escribe un mensaje manual..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <MessageCircle size={28} /> Chat WhatsApp
        </h2>
      </div>

      <div className="mb-4">
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Buscar teléfono..." />
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Cargando...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            No hay conversaciones todavía
          </div>
        ) : (
          <div className="divide-y">
            {filteredConversations.map(conv => (
              <div
                key={conv.telefono}
                onClick={() => setSelectedPhone(conv.telefono)}
                className="p-4 hover:bg-gray-50 cursor-pointer flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Phone size={18} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{conv.telefono}</div>
                  <div className="text-sm text-gray-500">
                    {conv.total_mensajes} mensaje(s) · {conv.ultima_fecha}
                  </div>
                </div>
                <div className="text-gray-300">›</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
