const logger = (message) => {
  const M = {
    info: function (msg) {
      console.info(msg);
    },
    // this will be sent to datadog
    log: function (msg) {
      console.log(msg);
      if (window.ritalite?.logger) {
        window.ritalite.log(JSON.stringify(message), "log");
      }
    },
    // this will be sent to datadog
    error: function (msg) {
      console.error(msg);
      if (window.ritalite?.logger) {
        window.ritalite.log(JSON.stringify(message), "error");
      }
    },
    warn: function (msg) {
      console.warn(msg);
    },
  };
  return M;
};
