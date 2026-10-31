/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as art from "../art.js";
import type * as billing_actions from "../billing/actions.js";
import type * as billing_data from "../billing/data.js";
import type * as billing_limits from "../billing/limits.js";
import type * as decks from "../decks.js";
import type * as demo from "../demo.js";
import type * as emailPrefs from "../emailPrefs.js";
import type * as emails from "../emails.js";
import type * as feed from "../feed.js";
import type * as footage from "../footage.js";
import type * as generation_ai from "../generation/ai.js";
import type * as generation_jobs from "../generation/jobs.js";
import type * as generation_scenes from "../generation/scenes.js";
import type * as generation_suggest from "../generation/suggest.js";
import type * as generation_worker from "../generation/worker.js";
import type * as insights from "../insights.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_art from "../lib/art.js";
import type * as lib_comments from "../lib/comments.js";
import type * as lib_counters from "../lib/counters.js";
import type * as lib_deck from "../lib/deck.js";
import type * as lib_demoReels from "../lib/demoReels.js";
import type * as lib_emailTemplates from "../lib/emailTemplates.js";
import type * as lib_feedShape from "../lib/feedShape.js";
import type * as lib_footageLibrary from "../lib/footageLibrary.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_random from "../lib/random.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_sample from "../lib/sample.js";
import type * as lib_share from "../lib/share.js";
import type * as lib_stepError from "../lib/stepError.js";
import type * as lib_uploads from "../lib/uploads.js";
import type * as lib_verify from "../lib/verify.js";
import type * as migrations from "../migrations.js";
import type * as rateLimits from "../rateLimits.js";
import type * as schema_validators from "../schema/validators.js";
import type * as share from "../share.js";
import type * as studies from "../studies.js";
import type * as studyCleanup from "../studyCleanup.js";
import type * as users from "../users.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  art: typeof art;
  "billing/actions": typeof billing_actions;
  "billing/data": typeof billing_data;
  "billing/limits": typeof billing_limits;
  decks: typeof decks;
  demo: typeof demo;
  emailPrefs: typeof emailPrefs;
  emails: typeof emails;
  feed: typeof feed;
  footage: typeof footage;
  "generation/ai": typeof generation_ai;
  "generation/jobs": typeof generation_jobs;
  "generation/scenes": typeof generation_scenes;
  "generation/suggest": typeof generation_suggest;
  "generation/worker": typeof generation_worker;
  insights: typeof insights;
  "lib/access": typeof lib_access;
  "lib/art": typeof lib_art;
  "lib/comments": typeof lib_comments;
  "lib/counters": typeof lib_counters;
  "lib/deck": typeof lib_deck;
  "lib/demoReels": typeof lib_demoReels;
  "lib/emailTemplates": typeof lib_emailTemplates;
  "lib/feedShape": typeof lib_feedShape;
  "lib/footageLibrary": typeof lib_footageLibrary;
  "lib/notify": typeof lib_notify;
  "lib/random": typeof lib_random;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/sample": typeof lib_sample;
  "lib/share": typeof lib_share;
  "lib/stepError": typeof lib_stepError;
  "lib/uploads": typeof lib_uploads;
  "lib/verify": typeof lib_verify;
  migrations: typeof migrations;
  rateLimits: typeof rateLimits;
  "schema/validators": typeof schema_validators;
  share: typeof share;
  studies: typeof studies;
  studyCleanup: typeof studyCleanup;
  users: typeof users;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
