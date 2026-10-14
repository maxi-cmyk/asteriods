#pragma once

constexpr int WIFI_STA = 1;
class TestWiFi {
    public:
    bool started = false;
    bool sleep = true;
    bool reconnect = true;
    void persistent(bool) {
    }
    void setAutoReconnect(bool enabled) {
        reconnect = enabled;
    }
    bool mode(int mode) {
        started = mode == WIFI_STA;
        return started;
    }
    bool setSleep(bool enabled) {
        sleep = enabled;
        return true;
    }
};
inline TestWiFi WiFi = {};
