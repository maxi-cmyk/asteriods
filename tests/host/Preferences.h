#pragma once
#include <map>
#include <string>
#include <vector>
#include <cstring>
class Preferences {
    public:
    inline static std::map<std::string, uint32_t> values = {};
    inline static int writes = 0;
    inline static bool fail_begin = false;
    inline static bool fail_write = false;
    inline static bool fail_read = false;
    inline static std::map<std::string, std::vector<uint8_t>> blobs = {};
    size_t getBytesLength(const char *key) {
        return blobs[key].size();
    }
    size_t getBytes(const char *key, void *data, size_t length) {
        if (fail_read) {
            return 0;
        }
        size_t count = std::min(length, blobs[key].size());
        memcpy(data, blobs[key].data(), count);
        return count;
    }
    size_t putBytes(const char *key, const void *data, size_t length) {
        ++writes;
        if (fail_write) {
            return 0;
        }
        const uint8_t *bytes = static_cast<const uint8_t *>(data);
        blobs[key] = std::vector<uint8_t>(bytes, bytes + length);
        return length;
    }
    bool begin(const char *, bool) {
        return !fail_begin;
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
