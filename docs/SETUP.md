# ESP32 Asteroids — Setup Guide

## Wiring

| Signal        | ESP32 Pin |
|---------------|-----------|
| Joystick X    | 34        |
| Joystick Y    | 35        |
| Joystick CLK  | 32        |
| Fire button   | 25        |
| Buzzer        | 27        |
| OLED SDA      | 21        |
| OLED SCL      | 22        |

- OLED: SSD1306 128×64 I2C at address `0x3C`
- Joystick button and fire button: wired active-low (pulled up internally)
- Buzzer: active buzzer driven by PWM on pin 27

## Build & Flash

```bash
pio run --target upload
pio device monitor --baud 115200
```

## Upload to esp32 
```bash
 ~/.platformio/penv/bin/pio run --target upload
```

## Troubleshooting

**OLED not found** — check SDA/SCL wiring and I2C address (`0x3C`). The firmware halts with a rapid beep sequence if the display fails to initialise.

**Joystick drifts** — hold the joystick centred on power-up; `inputInit()` reads centre calibration from 32 samples at boot.

**No sound** — confirm the buzzer is an *active* type. Passive buzzers need a different drive frequency.

**Double-click to pause not registering** — the detection window is 300 ms (`DBLCLICK_WINDOW` in `config.h`). Adjust if needed.
