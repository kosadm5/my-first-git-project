import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET() {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { db } = await connectToDatabase();

    // Fetch all chat histories  1233333333333333333333333
    const histories = await db.collection('treema_chat_history').find({}).toArray();
    const chatIds = histories.map(h => h.sessionId);

    // Fetch users corresponding to those chats
    const users = await db
        .collection('treema_authorized_users')
        .find({ chatId: { $in: chatIds } })
        .toArray();

    const enrichedUsers = users.map(u => {
        const history = histories.find(h => h.sessionId === u.chatId);
        let unreadCount = 0;
        let lastInteractionAt = null;

        if (history && history.messages && history.messages.length > 0) {
            const lastMsg = history.messages[history.messages.length - 1];
            lastInteractionAt = lastMsg.createdAt || null;

            const operatorLastReadAt = u.operatorLastReadAt ? new Date(u.operatorLastReadAt).getTime() : 0;
            const baselineDate = operatorLastReadAt > 0
                ? operatorLastReadAt
                : (u.hitlStartedAt ? new Date(u.hitlStartedAt).getTime() : 0);

            unreadCount = history.messages.filter((m: any) =>
                m.type === 'human' && m.createdAt && (new Date(m.createdAt).getTime() > baselineDate)
            ).length;
        }

        return { ...u, unreadCount, lastInteractionAt };
    });

    // Sort:
    // 1. HITL Waiting AND has recent unread -> Top
    // 2. HITL Waiting -> High priority
    // 3. Others -> Sorted by lastInteractionAt DESC (newest interactions first)
    enrichedUsers.sort((a: any, b: any) => {
        const aWaiting = a.isHitlEnabled && a.hitlStatus === 'waiting_operator';
        const bWaiting = b.isHitlEnabled && b.hitlStatus === 'waiting_operator';
        const tA = a.lastInteractionAt ? new Date(a.lastInteractionAt).getTime() : 0;
        const tB = b.lastInteractionAt ? new Date(b.lastInteractionAt).getTime() : 0;

        // If both are waiting, sort by newest message first (or oldest hitlStartedAt if no messages)
        if (aWaiting && bWaiting) {
            if (tA !== tB) return tB - tA;
            const sA = a.hitlStartedAt ? new Date(a.hitlStartedAt).getTime() : 0;
            const sB = b.hitlStartedAt ? new Date(b.hitlStartedAt).getTime() : 0;
            return sA - sB;
        }

        // If one is waiting and has unread messages, it strictly goes up
        if (aWaiting && a.unreadCount > 0) return -1;
        if (bWaiting && b.unreadCount > 0) return 1;

        // Otherwise, just sort by latest interaction time to always bubble up active chats
        if (tA !== tB) return tB - tA;

        // Fallback to waiting status
        if (aWaiting && !bWaiting) return -1;
        if (!aWaiting && bWaiting) return 1;

        return 0;
    });

    return NextResponse.json(enrichedUsers);
}

// Called by n8n escalation to create a new HITL ticket
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { chatId, user, lastMessage, status, timestamp } = body;

    if (!chatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 });

    const { db } = await connectToDatabase();
    await db.collection('treema_authorized_users').updateOne(
        { chatId: Number(chatId) },
        {
            $set: {
                isHitlEnabled: true,
                hitlStartedAt: new Date(timestamp || new Date()),
                hitlLastMessage: lastMessage || '',
                hitlStatus: status || 'waiting_operator',
                hitlUserInfo: user || {},
            },
        }
    );

    return NextResponse.json({ success: true });
}
