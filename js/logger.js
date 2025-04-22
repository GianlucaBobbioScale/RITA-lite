const logger = (message) => {
  const M = {
    info: function (msg) {
      console.info(msg);
    },
    log: function (msg) {
      console.log(msg);
    },
    error: function (msg) {
      console.error(msg);
      if (window.ritalite.logger) {
        window.ritalite.log(JSON.stringify(message), "error");
      }
    },
    warn: function (msg) {
      console.warn(msg);
    },
  };
  return M;
};
