import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ chatId: string }> }
) {
    const { chatId } = await params;

    let body;
    try {
        body = await req.json();
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { message } = body;

    if (!message || !chatId) {
        return NextResponse.json({ error: 'message and chatId required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // The LangChain AI agent and Inbox expect messages from the human in this format:
    // { type: 'human', data: { content: '...' } }
    const humanMsg = {
        type: 'human',
        data: { content: message },
        source: 'telegram_passthrough',
        createdAt: new Date().toISOString(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.collection('treema_chat_history') as any).updateOne(
        { sessionId: Number(chatId) },
        { $push: { messages: humanMsg } },
        { upsert: true }
    );

    return NextResponse.json({ success: true });
}
