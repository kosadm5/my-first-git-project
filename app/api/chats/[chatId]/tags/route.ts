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

    try {
        const body = await req.json();
        const { tag, action } = body; // action: 'add' | 'remove'

        if (!tag || !action) {
            return NextResponse.json({ error: 'tag and action required' }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        let updateQuery = {};
        if (action === 'add') {
            updateQuery = { $addToSet: { tags: tag } };
        } else if (action === 'remove') {
            updateQuery = { $pull: { tags: tag } };
        }

        await db.collection('treema_authorized_users').updateOne(
            { chatId: Number(chatId) },
            updateQuery
        );

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Failed to update tags", e);
        return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 });
    }
}
