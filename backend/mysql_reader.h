#ifndef BACKEND_MYSQL_READER_H
#define BACKEND_MYSQL_READER_H

#include <string>

#include "../algorithm/vrptw.h"

struct MySqlConfig {
    std::string host = "127.0.0.1";
    unsigned int port = 3306;
    std::string user = "root";
    std::string password;
    std::string database = "campus_shuttle_system";
};

class MySqlReader {
public:
    explicit MySqlReader(MySqlConfig config);

    VRPTWInstance loadInstance() const;

private:
    MySqlConfig config_;
};

#endif
