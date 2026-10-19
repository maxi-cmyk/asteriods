#pragma once
#include "Arduino.h"
extern "C" int browser_storage_read(void *, int);
extern "C" int browser_storage_write(const void *, int);
class Preferences {
    public:
    bool begin(const char *, bool) {
        return true;
    }
    size_t getBytesLength(const char *) {
        return browser_storage_read(nullptr, 0);
    }
    size_t getBytes(const char *, void *data, size_t length) {
        return browser_storage_read(data, length);
    }
    size_t putBytes(const char *, const void *data, size_t length) {
        return browser_storage_write(data, length);
    }
    void end() {
    }
};
