# Manual Home demo

`engine.mjs` owns an independent WASM instance, started only by Watch demo.
It has no storage or audio imports and cannot mutate the player runtime.
The shell clocks it only while Home is visible and stops it on exit.

`controller.cpp` is the shared autopilot implementation. The browser bridge
includes it here; `src/demo.cpp` remains the firmware build entry point.
Firmware idle-demo behavior is unchanged. Browser menu ticks cannot launch a
demo; only the engine invokes the explicit `web_demo` export.
