#!/usr/bin/env node
"use strict";

var assert = require("assert"),
    fs = require("fs"),
    path = require("path"),
    util = require("util");

var abaculus = require("abaculus"),
    async = require("async"),
    mkdirp = require("mkdirp"),
    nopt = require("nopt"),
    range = require("range").range,
    tilelive = require("tilelive");

var types = {
  config: String,
  "output-dir": String,
  require: Array,
  width: Number,
  height: Number
};

var shorthands = {
  c: "--config",
  o: "--output-dir",
  r: "--require",
  w: "--width",
  h: "--height"
};

var conf = nopt(types, shorthands),
    argv = conf.argv.remain,
    uri = argv.shift();

// default output directory to the current directory
conf["output-dir"] = conf["output-dir"] || ".";

assert.ok(conf.config, "A configuration is required.");
assert.ok(conf.width, "An image width is required.");
assert.ok(conf.height, "An image height is required.");
assert.ok(uri, "A tilelive URI is required.");

// require unregistered tilelive modules
require("./lib/modules")(tilelive, {
  require: conf.require
});

var places = require(path.resolve(conf.config));

async.waterfall([
  async.apply(tilelive.load, uri),
  function(source, done) {
    return async.eachSeries(Object.keys(places), function(name, done) {
      var place = places[name];

      return async.eachSeries(range(place.minzoom, place.maxzoom + 1), function(zoom, done) {
        console.log("Rendering %s at z%d...", name, zoom);

        return abaculus({
          zoom: zoom,
          center: {
            x: place.lon,
            y: place.lat,
            w: conf.width,
            h: conf.height
          },
          getTile: source.getTile.bind(source)
        }, function(err, image, headers) {
          if (err) {
            console.warn(err);
            // ignore
            return done();
          }

          var targetDir = path.resolve(path.join(conf["output-dir"], name)),
              targetPath = path.join(targetDir, util.format("z%d.png", zoom));

          return mkdirp(targetDir, function(err) {
            if (err) {
              return done(err);
            }

            return fs.writeFile(targetPath, image, done);
          });

        });

      }, done);
    }, done);
  }
], function(err) {
  if (err) {
    throw err;
  }
});
