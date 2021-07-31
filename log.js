const Dotenv = require('dotenv').config();
const LOG_LEVEL = process.env.LOG_LEVEL;

class Log {
    static now() {
        let options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
        return new Date().toLocaleString('en-us', options);
    }

    static log(...message) {
        if (LOG_LEVEL >= 3)
            console.log(this.now(), message.join(" "));
    }

    static warn(...message) {
        if (LOG_LEVEL >= 2)
            console.warn(this.now(), message.join(" "));
    }

    static error(...message) {
        if (LOG_LEVEL >= 1)
            console.error(this.now(), message.join(" "));
    }
}

module.exports = Log;