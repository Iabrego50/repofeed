export type FakeError = { message: string };

export type FakeResponse<T = unknown> = {
  data: T;
  error: FakeError | null;
  count: number | null;
};

export type FakeFilter = {
  method: string;
  args: unknown[];
};

export type FakeCall = {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  filters: FakeFilter[];
  payload?: unknown;
  columns?: string;
  countExact?: boolean;
  upsertOptions?: { onConflict?: string };
};

export type StorageRemove = {
  bucket: string;
  paths: string[];
};

export type FakeUser = {
  id: string;
  email?: string;
  name?: string;
};

type QueueItem = FakeResponse;

const emptyResponse = <T>(data: T, count: number | null = null): FakeResponse<T> => ({
  data,
  error: null,
  count,
});

export class FakeQuery {
  readonly filters: FakeFilter[] = [];
  op: FakeCall["op"] = "select";
  payload: unknown;
  columns = "*";
  countExact = false;
  upsertOptions: { onConflict?: string } | undefined;
  private wantSingle: "single" | "maybe" | null = null;

  constructor(
    private readonly table: string,
    private readonly fake: FakeSupabase,
  ) {}

  select(columns = "*", options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
    this.columns = columns;
    this.countExact = options?.count === "exact";
    return this;
  }

  insert(payload: unknown) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.op = "update";
    this.payload = payload;
    return this;
  }

  upsert(payload: unknown, options?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = payload;
    this.upsertOptions = options;
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ method: "eq", args: [column, value] });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ method: "neq", args: [column, value] });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ method: "in", args: [column, values] });
    return this;
  }

  not(column: string, op: string, value: unknown) {
    this.filters.push({ method: "not", args: [column, op, value] });
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push({ method: "gt", args: [column, value] });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ method: "gte", args: [column, value] });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ method: "lt", args: [column, value] });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ method: "lte", args: [column, value] });
    return this;
  }

  or(expr: string) {
    this.filters.push({ method: "or", args: [expr] });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ method: "is", args: [column, value] });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.filters.push({ method: "order", args: [column, options ?? {}] });
    return this;
  }

  limit(n: number) {
    this.filters.push({ method: "limit", args: [n] });
    return this;
  }

  single() {
    this.wantSingle = "single";
    return this;
  }

  maybeSingle() {
    this.wantSingle = "maybe";
    return this;
  }

  then<TResult1 = FakeResponse, TResult2 = never>(
    onfulfilled?: ((value: FakeResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): FakeResponse {
    const call: FakeCall = {
      table: this.table,
      op: this.op,
      filters: [...this.filters],
      payload: this.payload,
      columns: this.columns,
      countExact: this.countExact,
      upsertOptions: this.upsertOptions,
    };
    this.fake.calls.push(call);

    if (this.op === "update" || this.op === "delete") {
      return this.normalize(emptyResponse(this.payload ?? { id: "ok" }, 0));
    }

    const queued = this.fake.take(this.table);
    if (queued) {
      return this.normalize(queued);
    }

    if (this.op === "insert" || this.op === "upsert") {
      return this.normalize(emptyResponse(this.payload ?? null));
    }
    return this.normalize(emptyResponse(this.wantSingle ? null : [], this.countExact ? 0 : null));
  }

  private normalize(result: FakeResponse): FakeResponse {
    if (!this.wantSingle) return result;
    if (result.error) return result;
    if (Array.isArray(result.data)) {
      if (result.data.length === 0) {
        if (this.wantSingle === "single") {
          return { data: null, error: { message: "No rows found" }, count: 0 };
        }
        return { data: null, error: null, count: 0 };
      }
      return { ...result, data: result.data[0] };
    }
    if (result.data == null && this.wantSingle === "single") {
      return { data: null, error: { message: "No rows found" }, count: 0 };
    }
    return result;
  }
}

export class FakeStorageBucket {
  constructor(
    private readonly bucket: string,
    private readonly fake: FakeSupabase,
  ) {}

  async remove(paths: string[]): Promise<FakeResponse<string[]>> {
    this.fake.storageRemoves.push({ bucket: this.bucket, paths: [...paths] });
    const queued = this.fake.take(`storage:${this.bucket}`);
    if (queued) return queued as FakeResponse<string[]>;
    return emptyResponse(paths);
  }
}

export class FakeSupabase {
  readonly calls: FakeCall[] = [];
  readonly storageRemoves: StorageRemove[] = [];
  private readonly queues = new Map<string, QueueItem[]>();
  private user: FakeUser | null = null;

  private bearerToken = "test-access-token";

  readonly client = {
    from: (table: string) => new FakeQuery(table, this),
    auth: {
      getUser: async (jwt?: string) => {
        if (typeof jwt === "string") {
          if (!this.user || jwt !== this.bearerToken) {
            return { data: { user: null }, error: { message: "Invalid token" } };
          }
          return { data: { user: this.user }, error: null };
        }
        return {
          data: { user: this.user },
          error: this.user ? null : { message: "Not authenticated" },
        };
      },
      getSession: async () => ({
        data: {
          session: this.user
            ? { access_token: this.bearerToken, user: this.user }
            : null,
        },
        error: null,
      }),
    },
    storage: {
      from: (bucket: string) => new FakeStorageBucket(bucket, this),
    },
  };

  setUser(user: FakeUser | null) {
    this.user = user;
  }

  setBearerToken(token: string) {
    this.bearerToken = token;
  }

  queue(table: string, result: Partial<FakeResponse> & { data?: unknown }) {
    const list = this.queues.get(table) ?? [];
    list.push({
      data: result.data ?? null,
      error: result.error ?? null,
      count: result.count ?? (Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0),
    });
    this.queues.set(table, list);
  }

  take(table: string): QueueItem | undefined {
    const list = this.queues.get(table);
    if (!list || list.length === 0) return undefined;
    return list.shift();
  }

  reset() {
    this.calls.length = 0;
    this.storageRemoves.length = 0;
    this.queues.clear();
    this.user = null;
  }

  callsFor(table: string, op?: FakeCall["op"]): FakeCall[] {
    return this.calls.filter((c) => c.table === table && (op ? c.op === op : true));
  }

  lastCall(table: string, op?: FakeCall["op"]): FakeCall | undefined {
    return this.callsFor(table, op).at(-1);
  }

  filterEq(call: FakeCall, column: string): unknown {
    return call.filters.find((f) => f.method === "eq" && f.args[0] === column)?.args[1];
  }
}

export function createFakeSupabase(): FakeSupabase {
  return new FakeSupabase();
}

const holder: { current: FakeSupabase | null } = { current: null };

export function resetTestFake(): FakeSupabase {
  holder.current = createFakeSupabase();
  return holder.current;
}

export function getTestFake(): FakeSupabase {
  if (!holder.current) holder.current = createFakeSupabase();
  return holder.current;
}
