// ==UserScript==
// @name         Line Rider Fill Mod (Full)
// @namespace    https://www.linerider.com/
// @version      1.0.0
// @description  Fill selected shapes with adjustable angle and spacing
// @author       You
// @match        https://www.linerider.com/*
// @icon         https://www.linerider.com/favicon.ico
// @grant        none
// ==/UserScript==

const SELECT_TOOL = "SELECT_TOOL";
const EMPTY_SET = new Set();

const setTool = tool => ({ type: "SET_TOOL", payload: tool });
const setToolState = (id, state) => ({ type: "SET_TOOL_STATE", payload: state, meta: { id }});
const addLines = lines => ({ type: "UPDATE_LINES", payload: { linesToAdd: lines }, meta: { name: "FILL" }});
const commit = () => ({ type: "COMMIT_TRACK_CHANGES" });
const revert = () => ({ type: "REVERT_TRACK_CHANGES" });

const getSelectToolState = s => s.toolState[SELECT_TOOL];
const getTrack = s => s.simulator.committedEngine;
const getWidth = s => s.selectedSceneryWidth;

function rotatePoint(p, cos, sin) {
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

function* generateFill(lines, angle, spacing) {
  const r = angle * Math.PI / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);

  const segs = [];
  for (const l of lines) {
    let p1 = rotatePoint({ x: l.x1, y: l.y1 }, cos, sin);
    let p2 = rotatePoint({ x: l.x2, y: l.y2 }, cos, sin);
    if (p1.x > p2.x) [p1, p2] = [p2, p1];
    segs.push({ p1, p2 });
  }

  if (!segs.length) return;

  const minX = Math.min(...segs.map(s => s.p1.x));
  const maxX = Math.max(...segs.map(s => s.p2.x));

  for (let x = minX; x <= maxX; x += spacing) {
    const ys = [];
    for (const { p1, p2 } of segs) {
      if (x >= p1.x && x <= p2.x) {
        const t = (x - p1.x) / (p2.x - p1.x);
        ys.push(p1.y + t * (p2.y - p1.y));
      }
    }
    ys.sort((a, b) => a - b);
    for (let i = 0; i + 1 < ys.length; i += 2) {
      const a = rotatePoint({ x, y: ys[i] }, cos, -sin);
      const b = rotatePoint({ x, y: ys[i + 1] }, cos, -sin);
      yield { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }
  }
}

class FillMod {
  constructor(store) {
    this.store = store;
    this.active = false;
    this.angle = 0;
    this.spacing = 2;
    this.changed = false;
    store.subscribe(() => this.update());
  }

  update() {
    if (!this.active) return;

    this.store.dispatch(revert());
    this.changed = false;

    const state = this.store.getState();
    const sel = getSelectToolState(state);
    if (!sel || !sel.multi || !sel.selectedPoints || !sel.selectedPoints.size) return;

    const track = getTrack(state);
    const width = getWidth(state);

    const lineIds = new Set([...sel.selectedPoints].map(p => p >> 1));
    const lines = [...lineIds].map(id => track.getLine(id)).filter(Boolean);

    const filled = [];
    for (const l of generateFill(lines, this.angle, this.spacing)) {
      filled.push({ ...l, type: 2, width });
    }

    if (filled.length) {
      this.store.dispatch(addLines(filled));
      this.changed = true;
    }
  }

  commit() {
    if (this.changed) {
      this.store.dispatch(commit());
      this.store.dispatch(revert());
      this.changed = false;
    }
  }
}

function main() {
  const { React, store } = window;
  const e = React.createElement;
  const mod = new FillMod(store);

  class FillUI extends React.Component {
    constructor() {
      super();
      this.state = { active: false, angle: 0, spacing: 2 };
    }

    componentDidUpdate() {
      mod.active = this.state.active;
      mod.angle = this.state.angle;
      mod.spacing = Math.max(0.1, this.state.spacing);
      mod.update();
    }

    render() {
      return e("div", null,
        e("button", {
          style: { background: this.state.active ? "#9cf" : null },
          onClick: () => {
            store.dispatch(setTool(SELECT_TOOL));
            this.setState({ active: !this.state.active });
          }
        }, "Fill"),
        this.state.active && e("div", null,
          e("div", null, "Angle",
            e("input", {
              type: "range", min: 0, max: 360, step: 1,
              value: this.state.angle,
              onChange: ev => this.setState({ angle: +ev.target.value })
            })
          ),
          e("div", null, "Spacing",
            e("input", {
              type: "range", min: 0.5, max: 20, step: 0.5,
              value: this.state.spacing,
              onChange: ev => this.setState({ spacing: +ev.target.value })
            })
          ),
          e("button", { onClick: () => mod.commit() }, "Commit")
        )
      );
    }
  }

  window.registerCustomSetting(FillUI);
}

if (window.registerCustomSetting) main();
else {
  const prev = window.onCustomToolsApiReady;
  window.onCustomToolsApiReady = () => {
    prev && prev();
    main();
  };
}
