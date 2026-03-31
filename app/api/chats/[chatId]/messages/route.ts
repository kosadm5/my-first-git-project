import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ chatId: string }> }
) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { chatId } = await params;
    const numericChatId = Number(chatId);
    const { db } = await connectToDatabase();

    const record = await db.collection('treema_chat_history').findOne(
        { sessionId: numericChatId },
        { sort: { _id: -1 } }
    );

    if (!record) return NextResponse.json({ messages: [] });

    // Mark as read for the operator whenever they open/poll the messages route
    await db.collection('treema_authorized_users').updateOne(
        { chatId: Number(chatId) },
        { $set: { operatorLastReadAt: new Date().toISOString() } }
    );

    // Normalize messages — treema_chat_history uses two formats:
    // 1. Existing n8n LangChain format: { type: 'human'|'ai', data: { content: '...' } }
    // 2. Our operator format:           { type: 'operator', text: '...', operatorName, createdAt }
    const messages = (record.messages || []).map((m: {
        type: string;
        data?: { content?: string };
        text?: string;
        operatorName?: string;
        createdAt?: string;
    }, index: number) => {
        let content = '';
        if (m.type === 'human' || m.type === 'ai') {
            content = m.data?.content || '';
        } else if (m.type === 'operator') {
            // Legacy formats might still use text
            content = m.text || m.data?.content || '';
        }

        return {
            id: index,
            type: m.operatorName ? 'operator' : m.type, // UI overrides AI type to 'operator' visually if operatorName exists
            content,
            operatorName: m.operatorName,
            createdAt: m.createdAt,
        };
    });

    return NextResponse.json({ messages });
}
