import { designerNode } from "./agents/designer.js";
import { coderNode } from "./agents/coder.js";
import { artistNode } from "./agents/artist.js";
import { testerNode } from "./agents/tester.js";
import { managerNode, routeAfterManager } from "./agents/manager.js";
import { intakeNode, InterruptSignal } from "./human.js";

export const START = "__start__";
export const END = "__end__";

export function initialState({
  species,
  theme,
  autoApprove,
  outputDir,
  mode,
  maxRetries,
  injectCoderFailures = 0,
}) {
  return {
    species,
    theme,
    autoApprove,
    outputDir,
    mode,
    maxRetries,
    retries: 0,
    design: null,
    bundle: null,
    art: null,
    filesWritten: [],
    testReport: null,
    playable: false,
    failureCategory: null,
    status: "running",
    log: [],
    injectCoderFailures,
  };
}

function applyUpdate(state, update) {
  if (!update) return;
  for (const [key, value] of Object.entries(update)) {
    if (key === "log" && Array.isArray(value)) {
      state.log = [...(state.log || []), ...value];
    } else {
      state[key] = value;
    }
  }
}

export class Graph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.conditionals = new Map();
  }

  addNode(name, fn) {
    this.nodes.set(name, fn);
    return this;
  }

  addEdge(from, to) {
    this.edges.set(from, to);
    return this;
  }

  addConditionalEdges(from, router, mapping) {
    this.conditionals.set(from, { router, mapping });
    return this;
  }

  compile() {
    return new CompiledGraph(this);
  }
}

export class CompiledGraph {
  constructor(graph) {
    this.graph = graph;
    this.threads = new Map();
  }

  _thread(threadId) {
    if (!this.threads.has(threadId)) {
      this.threads.set(threadId, {
        state: null,
        next: START,
        resume: null,
        started: false,
      });
    }
    return this.threads.get(threadId);
  }

  nextNode(from, state) {
    if (this.graph.conditionals.has(from)) {
      const { router, mapping } = this.graph.conditionals.get(from);
      const route = router(state);
      const target = mapping[route];
      if (!target) throw new Error(`No mapping for route '${route}' from '${from}'`);
      return target;
    }
    if (this.graph.edges.has(from)) return this.graph.edges.get(from);
    return END;
  }

  async invoke(input, { threadId = "default", onEvent } = {}) {
    const thread = this._thread(threadId);
    if (input && Object.prototype.hasOwnProperty.call(input, "__resume")) {
      thread.resume = input.__resume;
      if (thread.state) delete thread.state.__interrupt__;
    } else if (!thread.started) {
      thread.state = { ...input, log: [...(input.log || [])] };
      thread.next = START;
      thread.started = true;
    }

    while (thread.next && thread.next !== END) {
      let name = thread.next;
      if (name === START) {
        thread.next = this.nextNode(START, thread.state);
        name = thread.next;
        if (!name || name === END) break;
      }

      onEvent?.({ type: "node_start", node: name });
      const fn = this.graph.nodes.get(name);
      if (!fn) throw new Error(`Unknown node: ${name}`);
      try {
        const stateForNode = { ...thread.state, __resume: thread.resume };
        const update = (await fn(stateForNode)) || {};
        thread.resume = null;
        applyUpdate(thread.state, update);
        delete thread.state.__resume;
        onEvent?.({ type: "node_end", node: name, log: update.log || [] });
        thread.next = this.nextNode(name, thread.state);
      } catch (err) {
        if (err instanceof InterruptSignal) {
          thread.next = name;
          thread.state.__interrupt__ = err.value;
          onEvent?.({ type: "interrupt", node: name, payload: err.value });
          return { ...thread.state, __interrupt__: err.value };
        }
        onEvent?.({ type: "error", node: name, message: err.message });
        throw err;
      }
    }

    if (thread.state) delete thread.state.__interrupt__;
    onEvent?.({ type: "complete", state: thread.state });
    return { ...thread.state };
  }
}

export function buildGraph(settings) {
  const graph = new Graph();
  graph.addNode("intake", (state) => intakeNode(state));
  graph.addNode("designer", (state) => designerNode(state, settings));
  graph.addNode("coder", (state) => coderNode(state, settings));
  graph.addNode("artist", (state) => artistNode(state, settings));
  graph.addNode("tester", (state) => testerNode(state));
  graph.addNode("manager", (state) => managerNode(state));
  graph.addEdge(START, "intake");
  graph.addEdge("intake", "designer");
  graph.addEdge("designer", "coder");
  graph.addEdge("coder", "artist");
  graph.addEdge("artist", "tester");
  graph.addEdge("tester", "manager");
  graph.addConditionalEdges("manager", routeAfterManager, {
    design: "designer",
    code: "coder",
    done: END,
  });
  return graph.compile();
}
