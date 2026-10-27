# Manual Home demo

`src/demo/engine.mjs` owns an independent WASM instance, started only by Watch demo.
It has no storage or audio imports and cannot mutate the player runtime.
The shell clocks it only while Home is visible and stops it on exit.

The browser demo plays the real game. `src/demo/pilot.mjs` reads the scene and feeds the engine
the inputs a person would: it dodges and shoots rocks, collects power-ups, uses the shield and
laser, and fights every boss with the steering the boss tests use (`boss-pilot.mjs`). The run
starts at wave 1 and carries on through every region and boss until the shell stops it. Running
out of lives is not the end: the engine hands the pilot its lives back (`web_demo_lives`), so
the demo never restarts on its own.

`controller.cpp` is the firmware's rock-only autopilot. The browser bridge includes it here;
`src/demo.cpp` remains the firmware build entry point. Firmware idle-demo behavior is
unchanged. The `web_demo` export (the old C++-driven demo state) is no longer used by the
shell; browser menu ticks cannot launch a demo.
