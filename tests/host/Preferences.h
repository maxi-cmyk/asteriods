#pragma once
#include <map>
#include <string>
class Preferences {
public:
  inline static std::map<std::string,uint32_t> values;
  inline static int writes = 0;
  bool begin(const char*, bool) { return true; }
  void end() {}
  uint32_t getUInt(const char* k, uint32_t fallback) { return values.count(k) ? values[k] : fallback; }
  void putUInt(const char* k, uint32_t v) { values[k] = v; ++writes; }
};
