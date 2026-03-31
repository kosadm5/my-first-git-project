'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface ChatUser {
    _id: string;
    chatId: number;
    firstName: string;
    username: string;
    isHitlEnabled: boolean;
    hitlStartedAt?: string;
    hitlLastMessage?: string;
    hitlStatus?: string;
    registeredAt?: string;
    qrParameter?: string;
    isAuthorized?: boolean;
    unreadCount?: number;
    lastInteractionAt?: string;
    tags?: string[];
}

interface Message {
    id: number;
    type: 'human' | 'ai' | 'operator';
    content: string;
    operatorName?: string;
    createdAt?: string;
}

// i18n Dictionary
const dict = {
    ru: {
        inbox: 'TSA Inbox',
        support: 'Treema Support',
        activeChats: 'Активные чаты',
        noActive: 'Нет активных HITL чатов',
        aiHandling: 'ИИ справляется со всем',
        waiting: '⏳ Ожидает',
        live: '🟢 В диалоге',
        selectChat: 'Выберите чат',
        selectDesc: 'Выберите диалог из списка слева, чтобы начать отвечать пользователю в Telegram',
        escalation: 'Эскалация',
        returnAI: '▶️ Вернуть ИИ (Disable HITL)',
        takeChat: '⏸️ Забрать чат (Enable HITL)',
        closeChat: '✕ Закрыть чат',
        closing: '⏳ Закрываем...',
        emptyHistory: 'История переписки пуста',
        placeholder: 'Напишите ответ пользователю... (Enter — отправить, Shift+Enter — новая строка)',
        send: 'Отправить',
        sending: 'Отправка',
        footerHint: '💡 Отвечаете за Treema Support. Сообщение получит пользователь в Telegram.',
        generateAI: '✨ AI Ответ',
        generating: 'Думает...',
        settings: 'Настройки',
        language: 'Язык / Language',
        theme: 'Внешний вид / Уведомления',
        userInfo: 'Информация о пользователе',
        metrics: 'Дополнительные метрики',
        userSince: 'ID пользователя в Telegram',
        tags: 'Теги / Категории',
        addTag: '+ Добавить тег',
        sound: 'Звуковые уведомления',
        tagNamePlaceholder: 'Имя тега...',
        hitlMarker: 'Вмешательство оператора (HITL)',
    },
    en: {
        inbox: 'TSA Inbox',
        support: 'Treema Support',
        activeChats: 'Active Chats',
        noActive: 'No active HITL chats',
        aiHandling: 'AI is handling everything',
        waiting: '⏳ Waiting',
        live: '🟢 Live',
        selectChat: 'Select a chat',
        selectDesc: 'Select a dialog from the list on the left to start replying to the user in Telegram',
        escalation: 'Escalation',
        returnAI: '▶️ Return to AI (Disable HITL)',
        takeChat: '⏸️ Take Chat (Enable HITL)',
        closeChat: '✕ Close Chat',
        closing: '⏳ Closing...',
        emptyHistory: 'Chat history is empty',
        placeholder: 'Write a response to the user... (Enter to send, Shift+Enter for new line)',
        send: 'Send',
        sending: 'Sending',
        footerHint: '💡 You are replying for Treema Support. The user will receive this in Telegram.',
        generateAI: '✨ AI Draft',
        generating: 'Thinking...',
        settings: 'Settings',
        language: 'Language / Язык',
        theme: 'Appearance / Notifications',
        userInfo: 'User Information',
        metrics: 'Additional Metrics',
        userSince: 'Telegram User ID',
        tags: 'Tags / Categories',
        addTag: '+ Add Tag',
        sound: 'Sound Notifications',
        tagNamePlaceholder: 'Tag name...',
        hitlMarker: 'Operator Intervention (HITL)',
    }
};

type Lang = 'ru' | 'en';

function formatTime(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function timeAgoExact(iso?: string, lang: Lang = 'ru') {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();

    today.setDate(today.getDate() - 1);
    const isYesterday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();

    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `${lang === 'ru' ? 'Сегодня' : 'Today'} ${timeStr}`;
    if (isYesterday) return `${lang === 'ru' ? 'Вчера' : 'Yesterday'} ${timeStr}`;

    const dateStr = d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' });
    return `${dateStr} ${timeStr}`;
}

function getInteractionBadge(iso?: string, lang: Lang = 'ru') {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);

    if (m <= 10) {
        return (
            <span style={{
                background: 'rgba(46, 160, 67, 0.15)', color: '#3fb950', fontSize: 10, fontWeight: 700,
                padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, letterSpacing: '0.5px'
            }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fb950' }} />
                LIVE
            </span>
        );
    } else {
        return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{timeAgoExact(iso, lang)}</span>;
    }
}

function getStatusBadge(chat?: ChatUser, lastInteractionAt?: string, lang: Lang = 'ru', noMargin = false) {
    if (!chat) return null;
    const style = noMargin ? {} : { marginLeft: 8 };

    if (chat.isHitlEnabled) {
        if (chat.hitlStatus === 'waiting_operator') {
            return <span className="badge badge-waiting" style={style}>{lang === 'ru' ? '⏳ Ожидает' : '⏳ Waiting'}</span>;
        }
        return <span className="badge badge-human" style={style}>{lang === 'ru' ? '👨‍💻 LIVE' : '👨‍💻 LIVE'}</span>;
    }

    if (chat.hitlStatus === 'resolved' || chat.hitlStatus === 'ai_handled') {
        return <span className="badge" style={{ ...style, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{lang === 'ru' ? '✅ Решен' : '✅ Resolved'}</span>;
    }

    const diff = lastInteractionAt ? (Date.now() - new Date(lastInteractionAt).getTime()) / 60000 : Infinity;
    if (diff <= 60) {
        return <span className="badge" style={{ ...style, background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>{lang === 'ru' ? '🤖 ИИ диалог' : '🤖 AI Active'}</span>;
    }

    return <span className="badge" style={{ ...style, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{lang === 'ru' ? '💤 Неактивен' : '💤 Inactive'}</span>;
}

function extractCleanContent(raw: string): string {
    return raw.replace(/^User\s+\S+\s+asks:\s+/i, '');
}

function renderContentWithLinks(text: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
        if (part.match(urlRegex)) {
            return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }} onClick={e => e.stopPropagation()}>{part}</a>;
        }
        return part;
    });
}

const playNotificationSound = () => {
    if (typeof window === 'undefined') return;
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) { console.error("Audio error", e) }
};

const showDesktopNotification = (title: string, body: string) => {
    if (typeof window === 'undefined' || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
        new Notification(title, { body });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
    }
};

export default function InboxPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [chats, setChats] = useState<ChatUser[]>([]);
    const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');

    // UI states
    const [sending, setSending] = useState(false);
    const [loadingChats, setLoadingChats] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [closing, setClosing] = useState(false);
    const [drafting, setDrafting] = useState(false);

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const prevUnreadCountRef = useRef(0);
    const hasRequestedNotificationRef = useRef(false);

    // Theme, Lang & Sound state
    const [theme, setTheme] = useState('dark');
    const [lang, setLang] = useState<Lang>('ru');
    const [soundEnabled, setSoundEnabled] = useState(true);
    const t = dict[lang];

    // Tags state
    const [newTag, setNewTag] = useState('');
    const [addingTag, setAddingTag] = useState(false);

    // Load preferences on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem('tsa_theme') || 'dark';
        const savedLang = (localStorage.getItem('tsa_lang') as Lang) || 'ru';
        const savedSound = localStorage.getItem('tsa_sound') !== 'false';
        setTheme(savedTheme);
        setLang(savedLang);
        setSoundEnabled(savedSound);
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    const changeTheme = (newTheme: string) => {
        setTheme(newTheme);
        localStorage.setItem('tsa_theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    const toggleLang = () => {
        const newLang = lang === 'ru' ? 'en' : 'ru';
        setLang(newLang);
        localStorage.setItem('tsa_lang', newLang);
    };

    const toggleSound = () => {
        const newVal = !soundEnabled;
        setSoundEnabled(newVal);
        localStorage.setItem('tsa_sound', newVal.toString());
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Check auth
    useEffect(() => {
        fetch('/api/auth/me').then(r => r.json()).then(data => {
            if (!data.isLoggedIn) router.push('/login');
            else setUsername(data.username || (lang === 'ru' ? 'Оператор' : 'Operator'));
        });
    }, [router, lang]);

    // Fetch chat list
    const fetchChats = useCallback(async () => {
        const res = await fetch('/api/chats');
        if (res.ok) {
            const data = await res.json();
            setChats(data);
        }
        setLoadingChats(false);
    }, []);

    // Fetch messages for selected chat
    const fetchMessages = useCallback(async (chatId: number, isInitial = false) => {
        const res = await fetch(`/api/chats/${chatId}/messages`);
        if (res.ok) {
            const data = await res.json();
            setMessages(prev => {
                if (isInitial || prev.length !== (data.messages || []).length) {
                    setTimeout(scrollToBottom, 100);
                }
                return data.messages || [];
            });
        }
        setLoadingMessages(false);
    }, []);

    // Initial load + polling
    useEffect(() => {
        fetchChats();
        pollingRef.current = setInterval(() => {
            fetchChats();
            if (selectedChatId) fetchMessages(selectedChatId, false);
        }, 4000);
        return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }, [fetchChats, fetchMessages, selectedChatId]);

    // Load messages when chat selected
    useEffect(() => {
        if (selectedChatId) {
            setLoadingMessages(true);
            setMessages([]);
            fetchMessages(selectedChatId, true);
            setSidebarOpen(false); // Close sidebar on new chat selection
        }
    }, [selectedChatId, fetchMessages]);

    // Handle new unread messages
    useEffect(() => {
        if (typeof window !== 'undefined' && !hasRequestedNotificationRef.current && "Notification" in window && Notification.permission === "default") {
            // Delay asking for permission to not annoy user immediately
            setTimeout(() => Notification.requestPermission(), 3000);
            hasRequestedNotificationRef.current = true;
        }

        const totalUnread = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        if (totalUnread > prevUnreadCountRef.current && prevUnreadCountRef.current !== 0) {
            // A new message arrived!
            if (soundEnabled) playNotificationSound();

            const chatsWithUnread = chats.filter(c => (c.unreadCount || 0) > 0);
            if (chatsWithUnread.length > 0) {
                const latestChat = chatsWithUnread[0];
                showDesktopNotification("Treema TSA", `${lang === 'ru' ? 'Новое сообщение от' : 'New message from'} ${latestChat.firstName}`);
            }
        }

        // Update ref only if chats are loaded
        if (!loadingChats) {
            prevUnreadCountRef.current = totalUnread;
        }
    }, [chats, loadingChats, lang, soundEnabled]);

    async function handleSend() {
        if (!inputText.trim() || !selectedChatId || sending) return;
        const text = inputText.trim();
        setInputText('');
        setSending(true);

        setMessages(prev => [...prev, {
            id: Date.now(), type: 'operator', content: text,
            operatorName: username, createdAt: new Date().toISOString()
        }]);
        setTimeout(scrollToBottom, 50);

        await fetch(`/api/chats/${selectedChatId}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text }),
        });
        setSending(false);
    }

    async function handleClose() {
        if (!selectedChatId || closing) return;
        setClosing(true);
        await fetch(`/api/chats/${selectedChatId}/close`, { method: 'POST' });
        setChats(prev => prev.map(c =>
            c.chatId === selectedChatId
                ? { ...c, isHitlEnabled: false, hitlStatus: 'resolved' }
                : c
        ));
        setClosing(false);
    }

    async function handleToggleHitl(enable: boolean) {
        if (!selectedChatId) return;
        setChats(prev => prev.map(c =>
            c.chatId === selectedChatId
                ? { ...c, isHitlEnabled: enable, hitlStatus: enable ? 'waiting_operator' : 'ai_handled' }
                : c
        ));
        await fetch(`/api/chats/${selectedChatId}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enable })
        });
    }

    async function handleAiDraft() {
        if (!selectedChatId || drafting) return;
        setDrafting(true);
        try {
            const res = await fetch(`/api/chats/${selectedChatId}/draft`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                if (data.draft) setInputText(data.draft);
            }
        } catch (e) {
            console.error("Failed to generate draft", e);
        }
        setDrafting(false);
    }
    const soundToggleInnerStyles = {
        width: 16, height: 16, borderRadius: '50%', background: 'white',
        transform: soundEnabled ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 0.2s', boxShadow: 'var(--shadow-sm)'
    };

    // --- TAGS AUTOCOMPLETE CONSTANTS ---
    const SUGGESTED_TAGS = ['VIP', 'Вопрос', 'Жалоба', 'Спам', 'Оплата', 'Bug', 'Feature', 'Resolved'];

    const handleAddTag = async (tagValue?: string) => {
        const tag = (tagValue || newTag).trim();
        if (!tag || !selectedChatId) {
            setAddingTag(false);
            setNewTag('');
            return;
        }
        setAddingTag(false);
        setNewTag('');

        // Optimistic update
        setChats(prev => prev.map(c => c.chatId === selectedChatId ? { ...c, tags: [...(c.tags || []), tag] } : c));

        await fetch(`/api/chats/${selectedChatId}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag, action: 'add' })
        });
    }

    async function handleRemoveTag(tag: string) {
        if (!selectedChatId) return;

        // Optimistic update
        setChats(prev => prev.map(c => c.chatId === selectedChatId ? { ...c, tags: (c.tags || []).filter(t => t !== tag) } : c));

        await fetch(`/api/chats/${selectedChatId}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag, action: 'remove' })
        });
    }

    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    }

    const selectedChat = chats.find(c => c.chatId === selectedChatId);

    return (
        <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)', overflow: 'hidden', position: 'relative' }}>

            {/* ─── SIDEBAR ─────────────────────────────────────────── */}
            <aside style={{
                width: 320, flexShrink: 0,
                background: 'var(--bg-secondary)',
                borderRight: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column',
                zIndex: 10
            }}>
                <div style={{
                    padding: '20px 20px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div
                            onClick={() => setSelectedChatId(null)}
                            title={lang === 'ru' ? "Сбросить выбор чата" : "Deselect chat"}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                        >
                            <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(88,166,255,0.25)',
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{t.inbox}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.support}</div>
                            </div>
                        </div>

                        {/* Profiles / Settings / Logout group */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
                            <button onClick={() => setSettingsOpen(!settingsOpen)} style={{
                                background: settingsOpen ? 'var(--bg-hover)' : 'transparent', border: 'none', cursor: 'pointer',
                                color: settingsOpen ? 'var(--text-primary)' : 'var(--text-muted)', padding: 6, borderRadius: 6, transition: 'all 0.2s',
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                            </button>

                            {/* Settings Popover */}
                            {settingsOpen && (
                                <>
                                    <div
                                        style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                                        onClick={() => setSettingsOpen(false)}
                                    />
                                    <div style={{
                                        position: 'absolute', top: 36, right: 0, width: 220,
                                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                        borderRadius: 12, padding: 16, zIndex: 100,
                                        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                                    }}>
                                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--text-primary)' }}>{t.settings}</div>

                                        {/* Lang Toggle */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t.language}</span>
                                            <button onClick={toggleLang} style={{
                                                background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                                                borderRadius: 6, padding: '4px 12px', fontSize: 12, color: 'var(--text-primary)',
                                                cursor: 'pointer', fontWeight: 600
                                            }}>
                                                {lang === 'ru' ? 'Русский' : 'English'}
                                            </button>
                                        </div>

                                        {/* Theme Picker */}
                                        <div style={{ marginBottom: 16 }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>{t.theme}</span>
                                            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                                                {[
                                                    { id: 'dark', color: '#0d1117', name: 'Dark' },
                                                    { id: 'light', color: '#ffffff', name: 'Light', border: '#d0d7de' },
                                                    { id: 'ocean', color: '#0f172a', name: 'Ocean' },
                                                    { id: 'sunset', color: '#1c1917', name: 'Sunset' },
                                                ].map(th => (
                                                    <button
                                                        key={th.id}
                                                        onClick={() => changeTheme(th.id)}
                                                        title={th.name}
                                                        style={{
                                                            width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
                                                            background: th.color,
                                                            border: theme === th.id ? '2px solid var(--accent)' : `1px solid ${th.border || '#30363d'}`,
                                                            transition: 'all 0.2s',
                                                            transform: theme === th.id ? 'scale(1.1)' : 'scale(1)',
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                                                {t.sound}
                                            </span>
                                            <div
                                                onClick={toggleSound}
                                                style={{
                                                    width: 36, height: 20, borderRadius: 10, background: soundEnabled ? 'var(--accent)' : 'var(--bg-tertiary)',
                                                    position: 'relative', cursor: 'pointer', transition: 'all 0.2s', border: soundEnabled ? 'none' : '1px solid var(--border)'
                                                }}
                                            >
                                                <div style={{
                                                    width: 16, height: 16, borderRadius: '50%', background: 'white',
                                                    position: 'absolute', top: soundEnabled ? 2 : 1, left: soundEnabled ? 18 : 1,
                                                    transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                }} />
                                            </div>
                                        </div>

                                        <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '16px 0' }} />

                                        <button onClick={handleLogout} style={{
                                            width: '100%', padding: '8px', borderRadius: 8, border: 'none',
                                            background: 'var(--red-dim)', color: 'var(--red)', cursor: 'pointer',
                                            fontSize: 13, fontWeight: 600, transition: 'all 0.2s'
                                        }}>
                                            Выйти
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 8,
                        background: 'var(--bg-tertiary)',
                    }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--green), #059669)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, color: 'white',
                        }}>
                            {username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{username}</div>
                            <div style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                                {/* Inline indicator */}
                                Online
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '12px 20px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {t.activeChats}
                    </span>
                    {chats.filter(c => c.isHitlEnabled).length > 0 && (
                        <span style={{
                            background: 'var(--accent)', color: 'white', fontSize: 11, fontWeight: 700,
                            padding: '1px 7px', borderRadius: 10,
                        }}>{chats.filter(c => c.isHitlEnabled).length}</span>
                    )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
                    {loadingChats ? (
                        [1, 2, 3].map(i => (
                            <div key={i} style={{ padding: '12px', margin: '0 0 4px', borderRadius: 10 }}>
                                <div className="skeleton" style={{ height: 14, width: '70%', marginBottom: 8 }} />
                                <div className="skeleton" style={{ height: 12, width: '90%' }} />
                            </div>
                        ))
                    ) : chats.length === 0 ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>💤</div>
                            <div style={{ fontSize: 13 }}>{t.noActive}</div>
                            <div style={{ fontSize: 11, marginTop: 4 }}>{t.aiHandling}</div>
                        </div>
                    ) : (
                        chats.map(chat => (
                            <button
                                key={chat.chatId}
                                onClick={() => setSelectedChatId(chat.chatId)}
                                style={{
                                    width: '100%', textAlign: 'left', padding: '12px 14px',
                                    borderRadius: 10, border: 'none', cursor: 'pointer',
                                    background: selectedChatId === chat.chatId ? 'var(--accent-glow)' : 'transparent',
                                    borderLeft: `3px solid ${selectedChatId === chat.chatId ? 'var(--accent)' : 'transparent'}`,
                                    transition: 'all 0.15s', marginBottom: 2,
                                    display: 'block',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                            background: `hsl(${((chat.chatId || 0) * 37) % 360}, 50%, 35%)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 13, fontWeight: 700, color: 'white',
                                        }}>
                                            {(chat.firstName || '?').charAt(0)}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                                                {chat.firstName}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                @{chat.username}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                        {getInteractionBadge(chat.lastInteractionAt || chat.hitlStartedAt, lang)}
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            {chat.unreadCount && chat.unreadCount > 0 ? (
                                                <span style={{
                                                    background: 'var(--red)', color: 'white', fontSize: 11, fontWeight: 700,
                                                    padding: '2px 6px', borderRadius: 10, marginRight: 6, display: 'inline-block'
                                                }}>
                                                    {chat.unreadCount}
                                                </span>
                                            ) : null}
                                            {getStatusBadge(chat, chat.lastInteractionAt || chat.hitlStartedAt, lang)}
                                        </div>
                                    </div>
                                </div>
                                {chat.hitlLastMessage && (
                                    <div style={{
                                        fontSize: 12, color: 'var(--text-secondary)', marginLeft: 40,
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                        {chat.hitlLastMessage}
                                    </div>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </aside>

            {/* ─── MAIN CHAT AREA ──────────────────────────────────── */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {!selectedChatId ? (
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-muted)',
                    }}>
                        <div style={{ fontSize: 64, marginBottom: 16, filter: 'grayscale(0.3)' }}>💬</div>
                        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                            {t.selectChat}
                        </div>
                        <div style={{ fontSize: 14, maxWidth: 280, textAlign: 'center', lineHeight: 1.6 }}>
                            {t.selectDesc}
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{
                            padding: '16px 24px',
                            borderBottom: '1px solid var(--border)',
                            background: 'var(--bg-secondary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            cursor: 'pointer' // make header clickable
                        }} onClick={() => setSidebarOpen(!sidebarOpen)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: '50%',
                                    background: `hsl(${((selectedChat?.chatId || 0) * 37) % 360}, 50%, 35%)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 16, fontWeight: 700, color: 'white',
                                }}>
                                    {(selectedChat?.firstName || '?').charAt(0)}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {selectedChat?.firstName}
                                        <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-muted)' }}>
                                            @{selectedChat?.username}
                                        </span>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ transform: sidebarOpen ? 'rotate(180deg)' : 'none', transition: 'all 0.2s' }}>
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        {t.escalation} {selectedChat?.hitlStartedAt ? timeAgoExact(selectedChat.hitlStartedAt, lang) : ''}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={e => e.stopPropagation()}>
                                {getStatusBadge(selectedChat, selectedChat?.lastInteractionAt || selectedChat?.hitlStartedAt, lang, true)}

                                <button
                                    onClick={() => selectedChat?.isHitlEnabled !== undefined && handleToggleHitl(!selectedChat.isHitlEnabled)}
                                    style={{
                                        padding: '8px 16px', borderRadius: 8,
                                        background: selectedChat?.isHitlEnabled ? 'var(--bg-tertiary)' : 'var(--accent)',
                                        border: `1px solid ${selectedChat?.isHitlEnabled ? 'var(--border)' : 'var(--accent)'}`,
                                        color: selectedChat?.isHitlEnabled ? 'var(--text-primary)' : 'white',
                                        fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    {selectedChat?.isHitlEnabled ? t.returnAI : t.takeChat}
                                </button>

                                <button
                                    onClick={handleClose} disabled={closing}
                                    style={{
                                        padding: '8px 16px', borderRadius: 8,
                                        background: closing ? 'var(--bg-tertiary)' : 'var(--red-dim)',
                                        border: '1px solid rgba(248,81,73,0.3)',
                                        color: 'var(--red)', fontWeight: 600, fontSize: 13,
                                        cursor: closing ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    {closing ? t.closing : t.closeChat}
                                </button>
                            </div>
                        </div>

                        <div style={{ position: 'relative', flex: 1, display: 'flex', overflow: 'hidden' }}>
                            <div style={{
                                flex: 1, overflowY: 'auto', padding: '24px',
                                display: 'flex', flexDirection: 'column', gap: 4,
                                background: 'var(--bg-primary)',
                            }}>
                                {loadingMessages ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
                                        <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 60 }}>
                                        <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                                        <div style={{ fontSize: 14 }}>{t.emptyHistory}</div>
                                    </div>
                                ) : (
                                    messages.map((msg, i) => {
                                        const isHuman = msg.type === 'human';
                                        const isAI = msg.type === 'ai';
                                        const isOperator = msg.type === 'operator';
                                        const cleanContent = extractCleanContent(msg.content);
                                        const msgTime = formatTime(msg.createdAt);

                                        // Проверка: нужно ли показать маркер перехода на HITL
                                        let showHitlMarker = false;
                                        if (selectedChat?.hitlStartedAt && msg.createdAt) {
                                            const hitlTime = new Date(selectedChat.hitlStartedAt).getTime();
                                            const currentMsgTime = new Date(msg.createdAt).getTime();
                                            // Если это первое сообщение ПОСЛЕ времени старта HITL
                                            if (currentMsgTime >= hitlTime) {
                                                const prevMsgTime = i > 0 && messages[i - 1].createdAt ? new Date(messages[i - 1].createdAt!).getTime() : 0;
                                                if (prevMsgTime < hitlTime) {
                                                    showHitlMarker = true;
                                                }
                                            }
                                        }

                                        return (
                                            <div key={msg.id || i}>
                                                {showHitlMarker && (
                                                    <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', opacity: 0.8 }}>
                                                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                                        <div style={{ padding: '0 16px', fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                            {t.hitlMarker} • {formatTime(selectedChat?.hitlStartedAt)}
                                                        </div>
                                                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                                    </div>
                                                )}
                                                <div className="animate-fade-in" style={{ display: 'flex', justifyContent: isHuman ? 'flex-start' : isOperator ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                                                    {(isHuman || isAI) && (
                                                        <div style={{
                                                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginRight: 8, marginTop: 4,
                                                            background: isAI ? 'linear-gradient(135deg, #7c3aed, #1d4ed8)' : `hsl(${((selectedChat?.chatId || 0) * 37) % 360}, 50%, 35%)`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white',
                                                        }}>
                                                            {isAI ? '🤖' : (selectedChat?.firstName || '?').charAt(0)}
                                                        </div>
                                                    )}
                                                    <div style={{ maxWidth: '72%' }}>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textAlign: isOperator ? 'right' : 'left' }}>
                                                            {isHuman && selectedChat?.firstName}
                                                            {isAI && '🤖 Treema AI'}
                                                            {isOperator && `👤 ${msg.operatorName || username}`}
                                                            {msg.createdAt && <span style={{ marginLeft: 6 }}>{formatTime(msg.createdAt)}</span>}
                                                        </div>
                                                        <div style={{
                                                            padding: '10px 14px', borderRadius: isOperator ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                                                            background: isOperator ? 'linear-gradient(135deg, #1d4ed8, #7c3aed)' : isAI ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                                                            border: isOperator ? 'none' : '1px solid var(--border-subtle)', color: isOperator ? 'white' : 'var(--text-primary)',
                                                            fontSize: 14, lineHeight: 1.6, boxShadow: isOperator ? '0 4px 12px rgba(88,166,255,0.2)' : 'var(--shadow-sm)',
                                                            whiteSpace: 'pre-wrap', wordBreak: 'break-word', position: 'relative', minWidth: 80
                                                        }}>
                                                            <div style={{ paddingBottom: 18 }}>{renderContentWithLinks(cleanContent)}</div>
                                                            <div style={{
                                                                position: 'absolute', bottom: 4, right: 10, fontSize: 10,
                                                                color: isOperator ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)'
                                                            }}>
                                                                {msgTime}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {isOperator && (
                                                        <div style={{
                                                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginLeft: 8, marginTop: 4,
                                                            background: 'linear-gradient(135deg, var(--green), #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: 11, fontWeight: 700, color: 'white',
                                                        }}>
                                                            {username.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* RIGHT SIDEBAR - USER METADATA */}
                            <div style={{
                                width: sidebarOpen ? 300 : 0, transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                borderLeft: sidebarOpen ? '1px solid var(--border)' : 'none',
                                background: 'var(--bg-secondary)', overflowX: 'hidden', whiteSpace: 'nowrap'
                            }}>
                                <div style={{ width: 300, padding: 24 }}>
                                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 24, color: 'var(--text-primary)' }}>{t.userInfo}</div>

                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
                                        <div style={{
                                            width: 80, height: 80, borderRadius: '50%', marginBottom: 16,
                                            background: `hsl(${((selectedChat?.chatId || 0) * 37) % 360}, 50%, 35%)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 32, fontWeight: 700, color: 'white',
                                        }}>
                                            {(selectedChat?.firstName || '?').charAt(0)}
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{selectedChat?.firstName}</div>
                                        <div style={{ color: 'var(--accent)', fontWeight: 500 }}>@{selectedChat?.username}</div>
                                    </div>

                                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{t.userSince}</div>
                                        <div style={{ fontSize: 15, fontWeight: 500, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{selectedChat?.chatId}</div>
                                    </div>

                                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 16 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>{t.metrics}</div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Message Count</span>
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>{messages.length}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: selectedChat?.registeredAt ? 8 : 0 }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>HITL Triggered</span>
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>{formatTime(selectedChat?.hitlStartedAt)}</span>
                                        </div>
                                        {selectedChat?.registeredAt && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, marginTop: 8 }}>
                                                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Registered</span>
                                                <span style={{ fontSize: 13, fontWeight: 600 }}>{new Date(selectedChat.registeredAt).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                        {selectedChat?.qrParameter && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, marginTop: 8 }}>
                                                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Source / QR</span>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{selectedChat.qrParameter}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 16, marginTop: 16 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>🏷️ {t.tags}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {selectedChat?.tags?.map(tag => (
                                                <span key={tag} style={{ padding: '4px 8px', background: 'rgba(124, 58, 237, 0.15)', color: '#a78bfa', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {tag}
                                                    <span onClick={() => handleRemoveTag(tag)} style={{ cursor: 'pointer', opacity: 0.6, fontSize: 13 }}>&times;</span>
                                                </span>
                                            ))}
                                            {addingTag ? (
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        type="text"
                                                        value={newTag}
                                                        onChange={e => setNewTag(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') { setAddingTag(false); setNewTag(''); } }}
                                                        // Removed onBlur to allow clicking on autocomplete items
                                                        autoFocus
                                                        placeholder={t.tagNamePlaceholder}
                                                        style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', width: 120, fontSize: 11 }}
                                                    />
                                                    {newTag.length > 0 && (
                                                        <div style={{
                                                            position: 'absolute', top: '100%', left: 0, marginTop: 4, width: 150,
                                                            background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6,
                                                            boxShadow: 'var(--shadow-md)', zIndex: 50, overflow: 'hidden'
                                                        }}>
                                                            {SUGGESTED_TAGS.filter(t => t.toLowerCase().includes(newTag.toLowerCase()) && !(selectedChat?.tags || []).includes(t)).map(suggestion => (
                                                                <div
                                                                    key={suggestion}
                                                                    onClick={() => handleAddTag(suggestion)}
                                                                    style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                                >
                                                                    {suggestion}
                                                                </div>
                                                            ))}
                                                            {!SUGGESTED_TAGS.map(t => t.toLowerCase()).includes(newTag.toLowerCase()) && (
                                                                <div
                                                                    onClick={() => handleAddTag()}
                                                                    style={{ padding: '6px 12px', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontStyle: 'italic' }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                                >
                                                                    + Создать "{newTag}"
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <button onClick={() => setAddingTag(true)} style={{ padding: '4px 8px', background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)', borderRadius: 6, fontSize: 11, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                                                    {t.addTag}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Message Input */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <textarea
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        placeholder={t.placeholder}
                                        rows={2}
                                        style={{
                                            width: '100%', padding: '12px 16px', background: 'var(--bg-primary)',
                                            border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)',
                                            fontSize: 14, resize: 'none', outline: 'none', lineHeight: 1.5,
                                            transition: 'border-color 0.2s', fontFamily: 'inherit',
                                        }}
                                        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                                    />
                                </div>

                                {/* AI DRAFT BUTTON */}
                                <button
                                    onClick={handleAiDraft}
                                    disabled={drafting || !selectedChatId}
                                    style={{
                                        padding: '12px', borderRadius: 12, border: '1px solid var(--accent)',
                                        background: 'transparent', color: drafting ? 'var(--text-muted)' : 'var(--accent)',
                                        fontWeight: 600, fontSize: 14, cursor: drafting ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s', height: 'fit-content',
                                        display: 'flex', alignItems: 'center', gap: 6,
                                    }}
                                    onMouseEnter={e => { if (!drafting) (e.currentTarget).style.background = 'var(--accent-glow)'; }}
                                    onMouseLeave={e => { if (!drafting) (e.currentTarget).style.background = 'transparent'; }}
                                >
                                    {drafting ? <span className="animate-spin" style={{ width: 14, height: 14, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} /> : t.generateAI}
                                </button>

                                {/* SEND BUTTON */}
                                <button
                                    onClick={handleSend}
                                    disabled={sending || !inputText.trim()}
                                    style={{
                                        padding: '12px 20px', borderRadius: 12, border: 'none',
                                        background: sending || !inputText.trim() ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
                                        color: sending || !inputText.trim() ? 'var(--text-muted)' : 'white',
                                        fontWeight: 600, fontSize: 14, cursor: sending || !inputText.trim() ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s', whiteSpace: 'nowrap',
                                        boxShadow: sending || !inputText.trim() ? 'none' : '0 4px 12px rgba(88,166,255,0.25)',
                                        display: 'flex', alignItems: 'center', gap: 6, height: 'fit-content', minWidth: 120, justifyContent: 'center',
                                    }}
                                >
                                    {sending ? (
                                        <>
                                            <span className="animate-spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                                            {t.sending}
                                        </>
                                    ) : (
                                        <>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                                            </svg>
                                            {t.send}
                                        </>
                                    )}
                                </button>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                                <span>{t.footerHint}</span>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
