"use strict";

var modules = require("tilelive-modules");

module.exports = function(tilelive, options) {
  options = options || {};
  options.require = options.require || [];

  modules.concat(options.require).forEach(function(name) {
    var mod;

    try {
      mod = require(name);
    } catch (err) {
      if (err.code !== "MODULE_NOT_FOUND") {
        console.warn(err.stack);
      }
      return;
    }

    try {
      if (typeof(mod.registerProtocols) === "function") {
        mod.registerProtocols(tilelive);
      } else {
        mod(tilelive, {
          retry: true
        });
      }
    } catch (err) {
      console.warn(err.stack);
    }
  });

  return tilelive;
};
