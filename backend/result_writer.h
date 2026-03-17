#ifndef BACKEND_RESULT_WRITER_H
#define BACKEND_RESULT_WRITER_H

#include <string>

#include "../algorithm/vrptw.h"
#include "mysql_reader.h"

class ResultWriter {
public:
    explicit ResultWriter(MySqlConfig config);

    void clearSchedule() const;
    int writeScheduleResult(const VRPTWInstance& instance, const ACOResult& result, const std::string& schedule_date) const;

private:
    MySqlConfig config_;
};

#endif
