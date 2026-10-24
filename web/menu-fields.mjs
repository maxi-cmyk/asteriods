// Shared field behavior for controller menus. Uses ordinary input/change events
// so draft validation and accessibility follow the same path as pointer input.
export function adjustField(field, direction) {
    if (!field || field.disabled) return false;
    if (field.matches('input[type="range"]')) {
        const step = Number(field.step) || 1;
        const minimum = Number(field.min) || 0;
        const maximum = Number(field.max) || 100;
        const value = Math.min(maximum,
            Math.max(minimum, Number(field.value) + direction * step));
        field.value = String(Number(value.toFixed(4)));
        field.dispatchEvent(new Event('input', {bubbles: true}));
        return true;
    }
    if (field.matches('select')) {
        field.selectedIndex = Math.min(field.options.length - 1,
            Math.max(0, field.selectedIndex + direction));
        field.dispatchEvent(new Event('change', {bubbles: true}));
        return true;
    }
    return false;
}
