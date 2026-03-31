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
    const { enable } = body; // boolean

    const { db } = await connectToDatabase();
    await db.collection('treema_authorized_users').updateOne(
        { chatId: Number(chatId) },
        {
            $set: {
                isHitlEnabled: enable,
                hitlStatus: enable ? 'waiting_operator' : 'ai_handled',
            },
        }
    );

    return NextResponse.json({ success: true, isHitlEnabled: enable });
}
