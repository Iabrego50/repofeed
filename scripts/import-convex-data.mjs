#!/usr/bin/env node
/**
 * Import Convex database snapshot into Supabase
 * 
 * Usage: node scripts/import-convex-data.mjs <path-to-db-snapshot-zip>
 * 
 * This script:
 * 1. Extracts the Convex snapshot
 * 2. Converts Convex IDs to UUIDs with a mapping
 * 3. Imports data into Supabase maintaining relationships
 * 4. Preserves timestamps and data integrity
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, createReadStream } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';

const exec = promisify(execCb);

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ID mapping from Convex IDs to UUIDs
const idMap = new Map();

function getUUID(convexId) {
  if (!idMap.has(convexId)) {
    idMap.set(convexId, randomUUID());
  }
  return idMap.get(convexId);
}

function convertTimestamp(convexTimestamp) {
  // Convex timestamps are in milliseconds since epoch
  return new Date(convexTimestamp).toISOString();
}

async function readJsonl(filePath) {
  const records = [];
  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim()) {
      records.push(JSON.parse(line));
    }
  }

  return records;
}

async function importTable(tableName, dataDir, transformer) {
  const filePath = join(dataDir, tableName, 'documents.jsonl');
  
  try {
    const records = await readJsonl(filePath);
    
    if (records.length === 0) {
      console.log(`  ℹ ${tableName}: No records to import`);
      return 0;
    }

    const transformed = records.map(transformer);
    
    // Insert in batches of 100
    const batchSize = 100;
    let imported = 0;
    
    for (let i = 0; i < transformed.length; i += batchSize) {
      const batch = transformed.slice(i, i + batchSize);
      const { error } = await supabase
        .from(tableName)
        .insert(batch);
      
      if (error) {
        console.error(`  ✗ Error importing ${tableName} (batch ${i}):`, error.message);
        throw error;
      }
      
      imported += batch.length;
    }
    
    console.log(`  ✓ ${tableName}: Imported ${imported} records`);
    return imported;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`  ℹ ${tableName}: File not found, skipping`);
      return 0;
    }
    throw error;
  }
}

async function main() {
  const zipPath = process.argv[2];
  
  if (!zipPath) {
    console.error('Usage: node scripts/import-convex-data.mjs <path-to-db-snapshot.zip>');
    process.exit(1);
  }

  console.log('🚀 Starting Convex to Supabase migration\n');
  
  // Extract zip to temp directory
  console.log('📦 Extracting snapshot...');
  const tmpDir = await mkdtemp(join(tmpdir(), 'convex-import-'));
  await exec(`unzip -q "${zipPath}" -d "${tmpDir}"`);
  console.log(`   Extracted to ${tmpDir}\n`);

  try {
    // Import in order respecting foreign key dependencies
    
    // 1. Users (no dependencies)
    await importTable('users', tmpDir, (record) => ({
      id: getUUID(record._id),
      token_identifier: record.tokenIdentifier,
      name: record.name || null,
      email: record.email || null,
      avatar: record.avatar || null,
      onboarded_at: record.onboardedAt || null,
      trial_used_at: record.trialUsedAt || null,
      created_at: convertTimestamp(record._creationTime),
      updated_at: convertTimestamp(record._creationTime),
    }));

    // 2. Workspaces
    await importTable('workspaces', tmpDir, (record) => ({
      id: getUUID(record._id),
      name: record.name,
      created_by: getUUID(record.createdBy),
      customer_id: record.customerId || null,
      seat_variant: record.seatVariant || null,
      seats: record.seats || null,
      billing_return_url: record.billingReturnUrl || null,
      checkout_by: record.checkoutBy ? getUUID(record.checkoutBy) : null,
      paid_plan: record.paidPlan || null,
      lapsed_plan: record.lapsedPlan || null,
      seat_overage: record.seatOverage || false,
      created_at: convertTimestamp(record._creationTime),
      updated_at: convertTimestamp(record._creationTime),
    }));

    // 3. Workspace members
    await importTable('workspace_members', tmpDir, (record) => ({
      id: getUUID(record._id),
      workspace_id: getUUID(record.workspaceId),
      user_id: getUUID(record.userId),
      role: record.role,
      created_at: convertTimestamp(record._creationTime),
    }));

    // 4. Workspace invites
    await importTable('workspace_invites', tmpDir, (record) => ({
      id: getUUID(record._id),
      workspace_id: getUUID(record.workspaceId),
      token: record.token,
      role: record.role,
      expires_at: record.expiresAt,
      created_by: getUUID(record.createdBy),
      revoked: record.revoked,
      uses: record.uses,
      max_uses: record.maxUses || null,
      created_at: convertTimestamp(record._creationTime),
    }));

    // 5. Workspace removals
    await importTable('workspace_removals', tmpDir, (record) => ({
      id: getUUID(record._id),
      workspace_id: getUUID(record.workspaceId),
      user_id: getUUID(record.userId),
      created_at: convertTimestamp(record._creationTime),
    }));

    // 6. Email preferences
    await importTable('email_prefs', tmpDir, (record) => ({
      id: getUUID(record._id),
      workspace_id: getUUID(record.workspaceId),
      user_id: getUUID(record.userId),
      new_studies: record.newStudies,
      feedback: record.feedback,
      created_at: convertTimestamp(record._creationTime),
      updated_at: convertTimestamp(record._creationTime),
    }));

    // 7. Rate limits
    await importTable('rate_limits', tmpDir, (record) => ({
      id: getUUID(record._id),
      key: record.key,
      window_start: record.windowStart,
      count: record.count,
      created_at: convertTimestamp(record._creationTime),
      updated_at: convertTimestamp(record._creationTime),
    }));

    // 8. Upload claims
    await importTable('upload_claims', tmpDir, (record) => ({
      id: getUUID(record._id),
      storage_id: getUUID(record.storageId),
      workspace_id: getUUID(record.workspaceId),
      created_at: convertTimestamp(record._creationTime),
    }));

    // 9. Studies
    await importTable('studies', tmpDir, (record) => ({
      id: getUUID(record._id),
      workspace_id: getUUID(record.workspaceId),
      title: record.title,
      audience: record.audience,
      goal: record.goal || null,
      status: record.status,
      tracks: record.tracks || [],
      created_by: getUUID(record.createdBy),
      published_at: record.publishedAt || null,
      last_error: record.lastError || null,
      is_demo: record.isDemo || false,
      deleting: record.deleting || false,
      created_at: convertTimestamp(record._creationTime),
      updated_at: convertTimestamp(record._creationTime),
    }));

    // 10. Sources
    await importTable('sources', tmpDir, (record) => ({
      id: getUUID(record._id),
      study_id: getUUID(record.studyId),
      workspace_id: getUUID(record.workspaceId),
      name: record.name,
      kind: record.kind,
      storage_id: record.storageId ? getUUID(record.storageId) : null,
      text: record.text,
      chars: record.chars,
      created_at: convertTimestamp(record._creationTime),
    }));

    // 11. Findings
    await importTable('findings', tmpDir, (record) => ({
      id: getUUID(record._id),
      study_id: getUUID(record.studyId),
      source_id: getUUID(record.sourceId),
      chunk_index: record.chunkIndex,
      type: record.type,
      text: record.text,
      speaker: record.speaker || null,
      number: record.number || null,
      label: record.label || null,
      strength: record.strength,
      created_at: convertTimestamp(record._creationTime),
    }));

    // 12. Reels
    await importTable('reels', tmpDir, (record) => {
      // Convert finding IDs in the array
      const findingIds = (record.findingIds || []).map((id) => getUUID(id));
      
      // Convert footage if present
      let footage = record.footage;
      if (footage && footage.clipId) {
        footage = {
          ...footage,
          clipId: getUUID(footage.clipId),
        };
        if (footage.storageId) {
          footage.storageId = getUUID(footage.storageId);
        }
      }
      
      return {
        id: getUUID(record._id),
        study_id: getUUID(record.studyId),
        workspace_id: getUUID(record.workspaceId),
        position: record.position,
        track: record.track,
        track_index: record.trackIndex,
        title: record.title,
        scenes: record.scenes || [],
        finding_ids: findingIds,
        source_names: record.sourceNames || [],
        warning: record.warning || null,
        enabled: record.enabled !== false,
        footage: footage || null,
        art: record.art || null,
        created_at: convertTimestamp(record._creationTime),
        updated_at: convertTimestamp(record._creationTime),
      };
    });

    // 13. Footage clips
    await importTable('footage_clips', tmpDir, (record) => ({
      id: getUUID(record._id),
      workspace_id: getUUID(record.workspaceId),
      storage_id: getUUID(record.storageId),
      url: record.url,
      name: record.name,
      size: record.size,
      uploaded_by: getUUID(record.uploadedBy),
      created_at: convertTimestamp(record._creationTime),
    }));

    // 14. Generation jobs
    await importTable('generation_jobs', tmpDir, (record) => ({
      id: getUUID(record._id),
      study_id: getUUID(record.studyId),
      workspace_id: getUUID(record.workspaceId),
      status: record.status,
      phase: record.phase,
      cursor: record.cursor,
      chunks: record.chunks || [],
      attempts: record.attempts,
      log: record.log || [],
      locked_until: record.lockedUntil,
      error: record.error || null,
      error_detail: record.errorDetail || null,
      started_by: getUUID(record.startedBy),
      created_at: convertTimestamp(record._creationTime),
      updated_at: convertTimestamp(record._creationTime),
    }));

    // 15. Reactions
    await importTable('reactions', tmpDir, (record) => ({
      id: getUUID(record._id),
      reel_id: getUUID(record.reelId),
      study_id: getUUID(record.studyId),
      user_id: getUUID(record.userId),
      kind: record.kind,
      created_at: convertTimestamp(record._creationTime),
    }));

    // 16. Share links
    await importTable('share_links', tmpDir, (record) => ({
      id: getUUID(record._id),
      study_id: getUUID(record.studyId),
      workspace_id: getUUID(record.workspaceId),
      token: record.token,
      created_by: getUUID(record.createdBy),
      revoked: record.revoked,
      hide_team_comments: record.hideTeamComments || false,
      created_at: convertTimestamp(record._creationTime),
    }));

    // 17. Guests
    await importTable('guests', tmpDir, (record) => ({
      id: getUUID(record._id),
      study_id: getUUID(record.studyId),
      link_id: getUUID(record.linkId),
      name: record.name,
      secret: record.secret,
      created_at: convertTimestamp(record._creationTime),
    }));

    // 18. Guest reactions
    await importTable('guest_reactions', tmpDir, (record) => ({
      id: getUUID(record._id),
      reel_id: getUUID(record.reelId),
      study_id: getUUID(record.studyId),
      guest_id: getUUID(record.guestId),
      kind: record.kind,
      created_at: convertTimestamp(record._creationTime),
    }));

    // 19. Guest views
    await importTable('guest_views', tmpDir, (record) => ({
      id: getUUID(record._id),
      reel_id: getUUID(record.reelId),
      study_id: getUUID(record.studyId),
      guest_id: getUUID(record.guestId),
      view_count: record.viewCount,
      completed: record.completed,
      last_viewed_at: record.lastViewedAt,
      created_at: convertTimestamp(record._creationTime),
      updated_at: convertTimestamp(record._creationTime),
    }));

    // 20. Comments
    await importTable('comments', tmpDir, (record) => ({
      id: getUUID(record._id),
      reel_id: getUUID(record.reelId),
      study_id: getUUID(record.studyId),
      user_id: record.userId ? getUUID(record.userId) : null,
      guest_id: record.guestId ? getUUID(record.guestId) : null,
      parent_id: record.parentId ? getUUID(record.parentId) : null,
      kind: record.kind,
      body: record.body,
      resolved: record.resolved,
      created_at: convertTimestamp(record._creationTime),
      updated_at: convertTimestamp(record._creationTime),
    }));

    // 21. Reel views
    await importTable('reel_views', tmpDir, (record) => ({
      id: getUUID(record._id),
      reel_id: getUUID(record.reelId),
      study_id: getUUID(record.studyId),
      user_id: getUUID(record.userId),
      view_count: record.viewCount,
      completed: record.completed,
      last_viewed_at: record.lastViewedAt,
      created_at: convertTimestamp(record._creationTime),
      updated_at: convertTimestamp(record._creationTime),
    }));

    // 22. Saved reels
    await importTable('saved_reels', tmpDir, (record) => ({
      id: getUUID(record._id),
      user_id: getUUID(record.userId),
      workspace_id: getUUID(record.workspaceId),
      reel_id: getUUID(record.reelId),
      study_id: getUUID(record.studyId),
      created_at: convertTimestamp(record._creationTime),
    }));

    // 23. Reel counters
    await importTable('reel_counters', tmpDir, (record) => ({
      id: getUUID(record._id),
      reel_id: getUUID(record.reelId),
      study_id: getUUID(record.studyId),
      true_count: record.trueCount,
      surprised_count: record.surprisedCount,
      pushback_count: record.pushbackCount,
      comment_count: record.commentCount,
      open_count: record.openCount,
      guest_comment_count: record.guestCommentCount || 0,
      guest_open_count: record.guestOpenCount || 0,
      views: record.views,
      viewers: record.viewers,
      completions: record.completions,
      created_at: convertTimestamp(record._creationTime),
      updated_at: convertTimestamp(record._creationTime),
    }));

    // 24. Decks
    await importTable('decks', tmpDir, (record) => {
      // Convert reel references
      const reels = (record.reels || []).map((reel) => ({
        ...reel,
        id: reel.id ? getUUID(reel.id) : undefined,
      }));
      
      return {
        id: getUUID(record._id),
        workspace_id: getUUID(record.workspaceId),
        scope: record.scope === 'all' ? 'all' : getUUID(record.scope),
        scope_label: record.scopeLabel,
        created_by: getUUID(record.createdBy),
        slides: record.slides || [],
        stats: record.stats,
        reels,
        created_at: convertTimestamp(record._creationTime),
      };
    });

    console.log('\n✅ Migration complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   Total records: ${idMap.size}`);
    console.log(`   ID mappings created: ${idMap.size}\n`);

  } finally {
    // Cleanup
    await rm(tmpDir, { recursive: true, force: true });
    console.log('🧹 Cleaned up temporary files\n');
  }
}

main().catch((error) => {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error);
  process.exit(1);
});
