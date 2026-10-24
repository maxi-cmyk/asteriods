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
