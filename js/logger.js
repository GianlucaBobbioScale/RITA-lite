const logger = {
  info: function (msg) {
    console.info(msg);
  },
  // this will be sent to datadog
  log: function (msg) {
    console.log(msg);
    if (window.ritalite?.log) {
      window.ritalite.log(JSON.stringify(msg), 'log');
    }
  },
  // this will be sent to datadog
  error: function (msg) {
    console.error(msg);
    if (window.ritalite?.log) {
      window.ritalite.log(JSON.stringify(msg), 'error');
    }
  },
  warn: function (msg) {
    console.warn(msg);
  },
};
