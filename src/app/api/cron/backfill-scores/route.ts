import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const wonSnap = await adminDb.collection('bets').where('status', '==', 'won').get();
    const lostSnap = await adminDb.collection('bets').where('status', '==', 'lost').get();

    const allDocs = [...wonSnap.docs, ...lostSnap.docs];

    if (allDocs.length === 0) {
      return NextResponse.json({ ok: true, message: 'No settled bets to backfill', updated: 0 });
    }

    // Gather unique match IDs that don't have score in selection
    const matchIds = new Set<string>();
    for (const doc of allDocs) {
      const data = doc.data();
      if (Array.isArray(data.selections)) {
        for (const sel of data.selections) {
          if (sel.matchId && !sel.score) {
            matchIds.add(sel.matchId);
          }
        }
      }
    }

    if (matchIds.size === 0) {
      return NextResponse.json({ ok: true, message: 'All settled bets already have scores', updated: 0 });
    }

    // Fetch match scores
    const matchMap = new Map<string, [number, number]>();
    const refs = Array.from(matchIds).map(id => adminDb.doc(`matches/${id}`));

    // Query in chunks of 30 docs to prevent Firestore limits
    const chunkSize = 30;
    for (let i = 0; i < refs.length; i += chunkSize) {
      const chunk = refs.slice(i, i + chunkSize);
      const snaps = await adminDb.getAll(...chunk);
      for (const snap of snaps) {
        if (snap.exists) {
          const d = snap.data();
          if (d && d.score) {
            matchMap.set(snap.id, [d.score[0], d.score[1]]);
          }
        }
      }
    }

    // Perform updates in a batch
    const batch = adminDb.batch();
    let updatedCount = 0;

    for (const doc of allDocs) {
      const data = doc.data();
      let changed = false;
      const updatedSelections = data.selections.map((sel: any) => {
        if (sel.matchId && !sel.score) {
          const score = matchMap.get(sel.matchId);
          if (score) {
            changed = true;
            return { ...sel, score };
          }
        }
        return sel;
      });

      if (changed) {
        batch.update(doc.ref, { selections: updatedSelections });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      ok: true,
      message: `Successfully backfilled scores for ${updatedCount} bets`,
      updated: updatedCount,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
