#pragma once
#include <map>
#include <string>
class Preferences {
    public:
    inline static std::map<std::string, uint32_t> values = {};
    inline static int writes = 0;
    bool begin(const char *, bool) {
        return true;
    }

    void end() {
    }

    uint32_t getUInt(const char *key, uint32_t fallback) {
        if (values.count(key)) {
            return values[key];
        }

        return fallback;
    }

    void putUInt(const char *key, uint32_t value) {
        values[key] = value;
        ++writes;
    }
};
