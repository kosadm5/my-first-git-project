import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const chatId = (await params).chatId;
    if (!chatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 });

    const { db } = await connectToDatabase();

    // Get chat history
    const history = await db.collection('treema_chat_history').findOne({ sessionId: Number(chatId) });
    if (!history || !history.messages || history.messages.length === 0) {
        return NextResponse.json({ draft: "Здравствуйте! Как я могу вам помочь?" }); // Default
    }

    // Get user lang preference if possible, default to Russian context
    const recentMessages = history.messages.slice(-10); // Take last 10 messages for context

    const contextStr = recentMessages.map((m: any) =>
        `${m.type === 'human' ? 'Пользователь' : 'Ассистент/Оператор'}: ${m.data?.content || m.content}`
    ).join('\n');

    const prompt = `You are a helpful and polite technical support operator for "Treema" platform.
    
Here is the recent chat history with the user:
---
${contextStr}
---

Your task:
Write a SHORT, polite, and helpful response (1-3 sentences maximum) that the human operator can send to the user RIGHT NOW.
- Answer in the language the user is primarily using in the history.
- Be concise.
- Start directly and never use placeholders like [Your Name].
- Provide ONLY the direct response text, nothing else.`;

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3 }
            })
        });

        if (!response.ok) {
            console.error("Gemini API error:", await response.text());
            return NextResponse.json({ draft: "" }); // Silent fail
        }

        const data = await response.json();
        const draftText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        return NextResponse.json({ draft: draftText.trim() });
    } catch (e) {
        console.error("Failed to generate draft", e);
        return NextResponse.json({ draft: "" });
    }
}
