// ==UserScript==
// @name         Line Rider Control Mod
// @namespace    https://www.linerider.com/
// @version      1.0.0
// @description  Advanced control over selected shapes: fill, line type, spacing, and angle
// @author       Hugolines
// @match        https://www.linerider.com/*
// @icon         https://www.linerider.com/favicon.ico
// @grant        none
// ==/UserScript==

const TOOL_SELECT = "SELECT_TOOL";

const createAction = (type, payload, meta) => ({ type, payload, meta });

const rotatePoint = (p, rad) => ({
    x: p.x * Math.cos(rad) - p.y * Math.sin(rad),
    y: p.x * Math.sin(rad) + p.y * Math.cos(rad)
});

function* generateControlFill(lines, angleDeg, spacing) {
    const rad = angleDeg * Math.PI / 180;
    const segments = lines.map(l => {
        let p1 = rotatePoint({ x: l.x1, y: l.y1 }, rad);
        let p2 = rotatePoint({ x: l.x2, y: l.y2 }, rad);
        if (p1.x > p2.x) [p1, p2] = [p2, p1];
        return { p1, p2 };
    });
    if (!segments.length) return;
    const minX = Math.min(...segments.map(s => s.p1.x));
    const maxX = Math.max(...segments.map(s => s.p2.x));
    for (let x = minX; x <= maxX; x += spacing) {
        const yPoints = [];
        for (const s of segments) {
            if (x >= s.p1.x && x <= s.p2.x) {
                const t = (x - s.p1.x) / (s.p2.x - s.p1.x);
                yPoints.push(s.p1.y + t * (s.p2.y - s.p1.y));
            }
        }
        yPoints.sort((a, b) => a - b);
        for (let i = 0; i + 1 < yPoints.length; i += 2) {
            const a = rotatePoint({ x, y: yPoints[i] }, -rad);
            const b = rotatePoint({ x, y: yPoints[i + 1] }, -rad);
            yield { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
        }
    }
}

class ControlMod {
    constructor(store) {
        this.store = store;
        this.active = false;
        this.angle = 0;
        this.spacing = 2;
        this.lineType = 2;
        this.modified = false;
        store.subscribe(() => this.update());
    }
    update() {
        if (!this.active) return;
        this.store.dispatch(createAction("REVERT_TRACK_CHANGES"));
        const state = this.store.getState();
        const selected = state.toolState[TOOL_SELECT];
        if (!selected?.selectedPoints?.size) return;
        const track = state.simulator.committedEngine;
        const width = state.selectedSceneryWidth;
        const lineIds = [...new Set([...selected.selectedPoints].map(p => p >> 1))];
        const lines = lineIds.map(id => track.getLine(id)).filter(Boolean);
        const newLines = [];
        for (const l of generateControlFill(lines, this.angle, this.spacing)) {
            newLines.push({ ...l, type: this.lineType, width });
        }
        if (newLines.length) {
            this.store.dispatch(createAction("UPDATE_LINES", { linesToAdd: newLines }, { name: "CONTROL_FILL" }));
            this.modified = true;
        }
    }
    commit() {
        if (this.modified) {
            this.store.dispatch(createAction("COMMIT_TRACK_CHANGES"));
            this.store.dispatch(createAction("REVERT_TRACK_CHANGES"));
            this.modified = false;
        }
    }
}

function init() {
    const { React, store } = window;
    const e = React.createElement;
    const mod = new ControlMod(store);
    class ControlUI extends React.Component {
        constructor() {
            super();
            this.state = { active: false, angle: 0, spacing: 2, lineType: 2 };
        }
        componentDidUpdate() {
            mod.active = this.state.active;
            mod.angle = this.state.angle;
            mod.spacing = Math.max(0.1, this.state.spacing);
            mod.lineType = this.state.lineType;
            mod.update();
        }
        render() {
            return e("div", null,
                e("button", { style: { background: this.state.active ? "#aaf" : null }, 
                    onClick: () => { store.dispatch(createAction("SET_TOOL", TOOL_SELECT)); this.setState({ active: !this.state.active }); }
                }, "Control Fill"),
                this.state.active && e("div", null,
                    e("div", null, "Angle", e("input", { type:"range", min:0, max:360, step:1, value:this.state.angle, onChange:ev=>this.setState({angle:+ev.target.value})})),
                    e("div", null, "Spacing", e("input", { type:"range", min:0.5, max:20, step:0.5, value:this.state.spacing, onChange:ev=>this.setState({spacing:+ev.target.value})})),
                    e("div", null, "Line Type", e("input", { type:"range", min:1, max:3, step:1, value:this.state.lineType, onChange:ev=>this.setState({lineType:+ev.target.value})})),
                    e("button", { onClick: () => mod.commit() }, "Apply")
                )
            );
        }
    }
    window.registerCustomSetting?.(ControlUI);
}

if (window.registerCustomSetting) init();
else { const old = window.onCustomToolsApiReady; window.onCustomToolsApiReady = () => { old?.(); init(); }; }
