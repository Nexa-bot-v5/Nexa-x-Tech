const os = require("os");

function runtimeUsage() {
    const used = process.memoryUsage().rss;  // Used RAM (bytes)
    const total = os.totalmem();             // Total RAM (bytes)

    const formatBytes = (bytes) => {
        const units = ["B", "KB", "MB", "GB", "TB"];
        let i = 0;
        let value = bytes;
        while (value >= 1024 && i < units.length - 1) {
            value /= 1024;
            i++;
        }
        return `${value.toFixed(1)}${units[i]}`;
    };

    return `${formatBytes(used)} of ${formatBytes(total)}`;
}

module.exports = runtimeUsage;
