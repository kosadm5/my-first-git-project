import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ chatId: string }> }
) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { chatId } = await params;
    const n8nUrl = process.env.N8N_HITL_WEBHOOK_URL!;

    // Send closing message via n8n to Telegram and reset HITL flag
    const closingMessage =
        'Диалог завершён. Если появятся новые вопросы — Treema Support Assistant снова готов помочь! 🤖';

    await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chatId: Number(chatId),
            message: closingMessage,
            operatorName: session.username || 'Operator',
            isHitlEnabled: false, // KEY: this resets the flag and AI takes over
        }),
    });

    // Also update MongoDB directly as a safety net
    const { db } = await connectToDatabase();
    await db.collection('treema_authorized_users').updateOne(
        { chatId: Number(chatId) },
        {
            $set: {
                isHitlEnabled: false,
                hitlClosedAt: new Date(),
                hitlStatus: 'resolved',
            },
        }
    );

    return NextResponse.json({ success: true });
}
