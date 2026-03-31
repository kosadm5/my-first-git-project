import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ chatId: string }> }
) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { chatId } = await params;
    const body = await req.json();
    const { message } = body;

    if (!message || !chatId) {
        return NextResponse.json({ error: 'message and chatId required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Read current isHitlEnabled from treema_authorized_users (correct collection for state)
    // mirrors production pattern: inbox passes current state so n8n IF can detect first message
    const userDoc = await db.collection('treema_authorized_users').findOne(
        { chatId: Number(chatId) },
        { projection: { isHitlEnabled: 1 } }
    );
    const currentHitlEnabled = userDoc?.isHitlEnabled === true;

    // Автоматическое включение HITL, если оператор написал первым
    if (!currentHitlEnabled) {
        await db.collection('treema_authorized_users').updateOne(
            { chatId: Number(chatId) },
            { 
                $set: { 
                    isHitlEnabled: true,
                    hitlStartedAt: new Date().toISOString()
                } 
            }
        );
    }

    const n8nUrl = process.env.N8N_HITL_WEBHOOK_URL!;

    // Forward to n8n — isHitlEnabled: false means "first message, enable HITL"
    const n8nRes = await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chatId: Number(chatId),
            message,
            operatorName: session.username || 'Operator',
            isHitlEnabled: currentHitlEnabled,
        }),
    });

    if (!n8nRes.ok) {
        return NextResponse.json({ error: 'Failed to send to n8n' }, { status: 502 });
    }

    // Save to treema_chat_history — write in same structure as LangChain AI (to avoid 'Got unexpected type' error)
    // operator messages use: { type: 'ai', data: { content: message }, operatorName, createdAt }
    const operatorMsg = {
        type: 'ai',
        data: { content: message },
        operatorName: session.username || 'Operator',
        createdAt: new Date().toISOString(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.collection('treema_chat_history') as any).updateOne(
        { sessionId: Number(chatId) },
        { $push: { messages: operatorMsg } },
        { upsert: true }
    );

    return NextResponse.json({ success: true });
}
