// Static IDs live for the application lifetime. Dynamic lists are queried fresh.
const ids = new Map();
export function element(id) {
    if (!ids.has(id)) {
        const node = document.getElementById(id);
        if (!node) throw new Error(`Missing application element: ${id}`);
        ids.set(id, node);
    }
    return ids.get(id);
}

/** Writes text only when it changed, so per-frame presenters never thrash layout. */
export function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
}

// The same for the other things a presenter writes every frame. Assigning an unchanged value
// still costs the browser a style or accessibility invalidation, so each writes only on change.
export function setProp(node, name, value) {
    if (node[name] !== value) node[name] = value;
}
export function setHidden(node, hidden) {
    if (node.hidden !== hidden) node.hidden = hidden;
}
export function setAttr(node, name, value) {
    if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}
export function setData(node, key, value) {
    if (node.dataset[key] !== value) node.dataset[key] = value;
}
export function setStyle(node, name, value) {
    if (node.style[name] !== value) node.style[name] = value;
}
export function setVar(node, name, value) {
    if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
}
